import { afterEach, describe, expect, it } from "bun:test";
import { ConfigService } from "@nestjs/config";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

import { makeFeed } from "../departures/gtfs-rt.utils.spec";
import { FakeCacheService, restoreFetch, stubFetch } from "../testing/fakes";
import { GtfsService } from "./gtfs.service";

const transit = GtfsRealtimeBindings.transit_realtime;

function makeService(cache = new FakeCacheService()) {
  const config = new ConfigService({
    SNCF_GTFSRT_URL: "https://feed.example.com/gtfs-rt",
  });

  return { service: new GtfsService(config, cache.asCacheService()), cache };
}

const feed = makeFeed([
  [{ stopId: "StopPoint:Test", departureTime: 1_784_000_000 }],
]);
const feedBytes = Buffer.from(transit.FeedMessage.encode(feed).finish());

afterEach(() => {
  restoreFetch();
});

describe("GtfsService.getFeed", () => {
  it("decodes raw protobuf bytes from Redis (§1.2)", async () => {
    const cache = new FakeCacheService();
    cache.setBuffer("gtfsRT:pb", feedBytes, 60);
    const { service } = makeService(cache);
    const { calls } = stubFetch(async () => new Response(null));

    const result = await service.getFeed();

    expect(result).not.toBeNull();
    expect(result?.isCached).toBe(true);
    expect(result?.data.entity).toHaveLength(1);
    expect(calls).toHaveLength(0);
  });

  it("fetches, stores the bytes, and serves the next call from memory", async () => {
    const { service, cache } = makeService();
    const { calls } = stubFetch(
      async () => new Response(new Uint8Array(feedBytes)),
    );

    const first = await service.getFeed();
    const second = await service.getFeed();

    expect(first?.isCached).toBe(false);
    expect(second?.isCached).toBe(true);
    expect(calls).toHaveLength(1);
    expect(await cache.getBuffer("gtfsRT:pb")).toEqual(feedBytes);
  });

  it("returns null when the feed cannot be fetched", async () => {
    const { service } = makeService();
    stubFetch(async () => new Response("gone", { status: 404 }));

    expect(await service.getFeed()).toBeNull();
  });
});
