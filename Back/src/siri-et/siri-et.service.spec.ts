import { afterEach, describe, expect, it } from "bun:test";
import { ConfigService } from "@nestjs/config";

import { FakeCacheService, restoreFetch, stubFetch } from "../testing/fakes";
import { SIRI_ET_FIXTURE } from "./siri-et.fixture";
import { SiriEtService } from "./siri-et.service";

function makeService(cache = new FakeCacheService()) {
  const config = new ConfigService({
    SNCF_SIRI_ET_URL: "https://feed.example.com/siri-et",
  });
  return { service: new SiriEtService(config, cache.asCacheService()), cache };
}

afterEach(() => {
  restoreFetch();
});

describe("SiriEtService.parseFeed", () => {
  it("extracts journeys calling at the watched stops, with calls and platforms", () => {
    const { service } = makeService();

    const journeys = service.parseFeed(SIRI_ET_FIXTURE);

    // all three fixture journeys touch Austerlitz or Étampes
    expect(journeys).toHaveLength(3);

    const rerC = journeys.find((j) => j.trainNumber === "145435");
    expect(rerC).toBeDefined();
    expect(rerC?.lineRef).toBe("C");
    expect(rerC?.destinationName).toBe("Saint-Martin d'Étampes");
    expect(rerC?.calls).toHaveLength(2);
    expect(rerC?.calls[0].departurePlatform).toBe("3");
    expect(rerC?.calls[0].expectedDepartureTime).toBe("2026-07-24T14:32:00Z");
  });

  it("extracts the 6-digit train number from the journey ref", () => {
    const { service } = makeService();
    const journeys = service.parseFeed(SIRI_ET_FIXTURE);
    expect(journeys.map((j) => j.trainNumber).sort()).toEqual([
      "145435",
      "860589",
      "860613",
    ]);
  });
});

describe("SiriEtService.getJourneys", () => {
  it("fetches, caches, and serves the next call from memory", async () => {
    const { service, cache } = makeService();
    const { calls } = stubFetch(async () => new Response(SIRI_ET_FIXTURE));

    const first = await service.getJourneys();
    const second = await service.getJourneys();

    expect(first?.isCached).toBe(false);
    expect(first?.data).toHaveLength(3);
    expect(second?.isCached).toBe(true);
    expect(calls).toHaveLength(1);
    expect(cache.jsonWrites[0]).toEqual({
      key: "siriET:journeys",
      ttlSeconds: 60,
    });
  });

  it("returns null when the feed cannot be fetched", async () => {
    const { service } = makeService();
    stubFetch(async () => new Response("nope", { status: 502 }));

    expect(await service.getJourneys()).toBeNull();
  });
});
