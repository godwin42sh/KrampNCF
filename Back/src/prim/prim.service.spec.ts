import { afterEach, describe, expect, it } from "bun:test";
import { ConfigService } from "@nestjs/config";
import { ServiceUnavailableException } from "@nestjs/common";

import primsData from "../config/prim-data";
import { FakeCacheService, restoreFetch, stubFetch } from "../testing/fakes";
import { PrimService } from "./prim.service";

function makeService(configured = true, cache = new FakeCacheService()) {
  const config = new ConfigService(
    configured
      ? {
          SNCF_API_PRIM_URL: "https://prim.example.com/marketplace",
          SNCF_API_PRIM_KEY: "prim-key",
        }
      : {},
  );

  return { service: new PrimService(config, cache.asCacheService()), cache };
}

afterEach(() => {
  restoreFetch();
});

describe("PrimService", () => {
  it("builds the stop-monitoring URL with only MonitoringRef (no LineRef)", () => {
    const { service } = makeService();

    const url = service.makeUrlFromPrimData(primsData[0]);

    expect(url).toBe(
      "https://prim.example.com/marketplace/stop-monitoring" +
        `?MonitoringRef=${encodeURIComponent(primsData[0].primDepartureRef)}`,
    );
    expect(url).not.toContain("LineRef");
  });

  it("fetches deliveries with the api key and caches them", async () => {
    const { service, cache } = makeService();
    const deliveries = [{ MonitoredStopVisit: [] }];
    let sentHeaders: Record<string, string> | undefined;
    stubFetch(async (_url, init) => {
      sentHeaders = init?.headers as Record<string, string>;
      return Response.json({
        Siri: { ServiceDelivery: { StopMonitoringDelivery: deliveries } },
      });
    });

    const result = await service.getDepartures(primsData[0]);

    expect(result.isCached).toBe(false);
    expect(result.data).toEqual(deliveries as never);
    expect(sentHeaders?.apikey).toBe("prim-key");
    expect(cache.jsonWrites[0].ttlSeconds).toBe(120);
  });

  it("returns an empty list when the upstream call fails", async () => {
    const { service } = makeService();
    stubFetch(async () => new Response("nope", { status: 401 }));

    const result = await service.getDepartures(primsData[0]);

    expect(result).toEqual({ isCached: false, data: [] });
  });

  it("throws 503 when PRIM is not configured", async () => {
    const { service } = makeService(false);

    expect(service.getDepartures(primsData[0])).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
