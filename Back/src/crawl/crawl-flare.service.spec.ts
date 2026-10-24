import { afterEach, beforeEach, describe, expect, it, setSystemTime } from "bun:test";
import { ConfigService } from "@nestjs/config";
import { ServiceUnavailableException } from "@nestjs/common";

import crawlsData from "../config/crawl-data";
import { FakeCacheService, restoreFetch, stubFetch } from "../testing/fakes";
import { CrawlFlareService } from "./crawl-flare.service";

function makeService(configured = true, cache = new FakeCacheService()) {
  const config = new ConfigService(
    configured
      ? {
          SNCF_CRAWL_FLARE_URL:
            "https://www.garesetconnexions.sncf/schedule-table",
        }
      : {},
  );

  return {
    service: new CrawlFlareService(config, cache.asCacheService()),
    cache,
  };
}

const departures = [{ trainNumber: "123456" }, { trainNumber: "654321" }];

function expectRandomTtl(ttlSeconds: number) {
  expect(ttlSeconds).toBeGreaterThanOrEqual(4 * 60);
  expect(ttlSeconds).toBeLessThanOrEqual(6 * 60);
}

beforeEach(() => {
  // Daytime in Paris so the service-hours gate is open.
  setSystemTime(new Date("2026-07-23T12:00:00+02:00"));
});

afterEach(() => {
  restoreFetch();
  setSystemTime();
});

describe("CrawlFlareService.getDepartures", () => {
  it("fetches the schedule-table JSON directly, cached 4-6 minutes", async () => {
    const { service, cache } = makeService();
    const { calls } = stubFetch(async () => Response.json(departures));

    const result = await service.getDepartures(crawlsData[0]);

    expect(result.isCached).toBe(false);
    expect(result.data).toEqual(departures as never);
    expect(calls).toEqual([
      `https://www.garesetconnexions.sncf/schedule-table/Departures/${crawlsData[0].flareId}`,
    ]);
    const boardWrite = cache.jsonWrites.find((w) =>
      w.key.includes("/Departures/"),
    );
    expect(boardWrite?.key).toBe(
      `crawlFlare:https://www.garesetconnexions.sncf/schedule-table/Departures/${crawlsData[0].flareId}`,
    );
    expectRandomTtl(boardWrite!.ttlSeconds);
  });

  it("caches an HTTP error as an empty list, briefly, so the next call retries", async () => {
    const { service, cache } = makeService();
    stubFetch(async () => new Response("blocked", { status: 403 }));

    const result = await service.getDepartures(crawlsData[0]);

    expect(result.data).toEqual([]);
    const boardWrite = cache.jsonWrites.find((w) =>
      w.key.includes("/Departures/"),
    );
    expect(boardWrite?.ttlSeconds).toBe(30);
  });

  it("serves from the cache on the second call", async () => {
    const { service } = makeService();
    const { calls } = stubFetch(async () => Response.json(departures));

    await service.getDepartures(crawlsData[0]);
    const second = await service.getDepartures(crawlsData[0]);

    expect(second.isCached).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("does not crawl outside 7h-22h Paris time", async () => {
    setSystemTime(new Date("2026-07-23T23:30:00+02:00"));
    const { service, cache } = makeService();
    const { calls } = stubFetch(async () => Response.json(departures));

    const result = await service.getDepartures(crawlsData[0]);

    expect(result.data).toEqual([]);
    expect(calls).toHaveLength(0);
    expect(cache.jsonWrites).toHaveLength(0);
  });

  it("pauses crawling after 5 consecutive failures", async () => {
    const { service, cache } = makeService();
    const { calls } = stubFetch(async () => new Response("", { status: 403 }));
    const boardKey = `crawlFlare:https://www.garesetconnexions.sncf/schedule-table/Departures/${crawlsData[0].flareId}`;

    for (let i = 0; i < 5; i++) {
      await service.getDepartures(crawlsData[0]);
      cache.deleteJson(boardKey); // the fake cache never expires the 30s entry
    }

    expect(calls).toHaveLength(5);
    expect(await cache.getJson<boolean>("crawlFlare:cooldown")).toBe(true);

    // While on cooldown, no request goes out.
    await service.getDepartures(crawlsData[0]);
    expect(calls).toHaveLength(5);
  });

  it("resets the failure counter on success (empty results included)", async () => {
    const { service, cache } = makeService();
    const boardKey = `crawlFlare:https://www.garesetconnexions.sncf/schedule-table/Departures/${crawlsData[0].flareId}`;

    stubFetch(async () => new Response("", { status: 403 }));
    await service.getDepartures(crawlsData[0]);
    cache.deleteJson(boardKey);
    expect(await cache.getJson<number>("crawlFlare:failures")).toBe(1);

    restoreFetch();
    stubFetch(async () => Response.json([]));
    await service.getDepartures(crawlsData[0]);

    expect(await cache.getJson<number>("crawlFlare:failures")).toBe(0);
    expect(await cache.getJson("crawlFlare:cooldown")).toBeNull();
  });

  it("throws 503 when the base URL is not configured", async () => {
    const { service } = makeService(false);

    expect(service.getDepartures(crawlsData[0])).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
