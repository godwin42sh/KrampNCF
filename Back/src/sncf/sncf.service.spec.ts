import { afterEach, describe, expect, it } from "bun:test";
import { ConfigService } from "@nestjs/config";

import { FakeCacheService, restoreFetch, stubFetch } from "../testing/fakes";
import { SncfService } from "./sncf.service";

function makeService(cache = new FakeCacheService()) {
  const config = new ConfigService({
    SNCF_API_URL: "https://api.example.com/v1",
    SNCF_API_KEY: "test-key",
  });

  return { service: new SncfService(config, cache.asCacheService()), cache };
}

afterEach(() => {
  restoreFetch();
});

describe("SncfService.getDepartures", () => {
  it("fetches departures and caches them for 120s", async () => {
    const { service, cache } = makeService();
    const departures = [{ some: "departure" }];
    const { calls } = stubFetch(async () =>
      Response.json({ departures }),
    );

    const result = await service.getDepartures(
      "stop_area:IDFM:478855",
      new Date("2026-07-23T12:00:30"),
      { lines: "line:IDFM:C01857" },
    );

    expect(result.isCached).toBe(false);
    expect(result.data).toEqual(departures as never);
    expect(calls[0]).toContain(
      "stop_areas/stop_area:IDFM:478855/lines/line:IDFM:C01857/departures",
    );
    expect(calls[0]).toContain("from_datetime=");
    expect(cache.jsonWrites).toEqual([
      { key: expect.stringContaining("sncf:"), ttlSeconds: 120 },
    ]);
  });

  it("serves from the cache on the second call", async () => {
    const { service } = makeService();
    const { calls } = stubFetch(async () =>
      Response.json({ departures: [{ id: 1 }] }),
    );

    const dateFrom = new Date("2026-07-23T12:00:30");
    await service.getDepartures("station", dateFrom);
    const second = await service.getDepartures("station", dateFrom);

    expect(second.isCached).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("buckets the cache key to 2 minutes (§1.5)", async () => {
    const { service, cache } = makeService();
    stubFetch(async () => Response.json({ departures: [{ id: 1 }] }));

    // 12:00:30 and 12:01:45 -> same bucket; 12:02:10 -> next bucket
    await service.getDepartures("station", new Date("2026-07-23T12:00:30"));
    const sameBucket = await service.getDepartures(
      "station",
      new Date("2026-07-23T12:01:45"),
    );
    const nextBucket = await service.getDepartures(
      "station",
      new Date("2026-07-23T12:02:10"),
    );

    expect(sameBucket.isCached).toBe(true);
    expect(nextBucket.isCached).toBe(false);
    expect(cache.jsonWrites).toHaveLength(2);
    expect(cache.jsonWrites[0].key).toContain("12.00");
    expect(cache.jsonWrites[1].key).toContain("12.02");
  });

  it("returns an empty list when the upstream call fails", async () => {
    const { service, cache } = makeService();
    stubFetch(async () => new Response("nope", { status: 500 }));

    const result = await service.getDepartures(
      "station",
      new Date("2026-07-23T12:00:00"),
    );

    expect(result).toEqual({ isCached: false, data: [] });
    expect(cache.jsonWrites).toHaveLength(0);
  });
});
