import { afterEach, describe, expect, it } from "bun:test";
import { ConfigService } from "@nestjs/config";
import { ServiceUnavailableException } from "@nestjs/common";

import crawlsData from "../config/crawl-data";
import { FakeCacheService, restoreFetch, stubFetch } from "../testing/fakes";
import { CrawlFlareService } from "./crawl-flare.service";

function makeService(configured = true, cache = new FakeCacheService()) {
  const config = new ConfigService(
    configured
      ? {
          FLARE_API_URL: "http://flaresolverr:8191/v1",
          SNCF_CRAWL_FLARE_URL: "https://www.sncf.com/api/gares",
          REDIS_CRAWL_EXPIRE: 60,
        }
      : {},
  );

  return {
    service: new CrawlFlareService(config, cache.asCacheService()),
    cache,
  };
}

const departures = [{ trainNumber: "123456" }, { trainNumber: "654321" }];
const flareHtml = `<html><body><pre>${JSON.stringify(departures)}</pre></body></html>`;

afterEach(() => {
  restoreFetch();
});

describe("CrawlFlareService.getDepartures", () => {
  it("extracts the JSON payload from the FlareSolverr HTML response", async () => {
    const { service, cache } = makeService();
    const { calls } = stubFetch(async () =>
      Response.json({ solution: { response: flareHtml } }),
    );

    const result = await service.getDepartures(crawlsData[0]);

    expect(result.isCached).toBe(false);
    expect(result.data).toEqual(departures as never);
    expect(calls).toEqual(["http://flaresolverr:8191/v1"]);
    expect(cache.jsonWrites).toEqual([
      {
        key: `crawlFlare:https://www.sncf.com/api/gares/Departures/${crawlsData[0].flareId}`,
        ttlSeconds: 60,
      },
    ]);
  });

  it("returns an empty list when the payload cannot be extracted, cached briefly", async () => {
    const { service, cache } = makeService();
    stubFetch(async () =>
      Response.json({ solution: { response: "<html>challenge page</html>" } }),
    );

    const result = await service.getDepartures(crawlsData[0]);

    expect(result.data).toEqual([]);
    // empty results must not stick for the whole configured TTL (60 here)
    expect(cache.jsonWrites).toEqual([
      { key: expect.stringContaining("crawlFlare:"), ttlSeconds: 30 },
    ]);
  });

  it("serves from the cache on the second call", async () => {
    const { service } = makeService();
    const { calls } = stubFetch(async () =>
      Response.json({ solution: { response: flareHtml } }),
    );

    await service.getDepartures(crawlsData[0]);
    const second = await service.getDepartures(crawlsData[0]);

    expect(second.isCached).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("throws 503 when FlareSolverr is not configured", async () => {
    const { service } = makeService(false);

    expect(service.getDepartures(crawlsData[0])).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
