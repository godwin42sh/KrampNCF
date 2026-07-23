import { afterEach, describe, expect, it } from "bun:test";
import { ConfigService } from "@nestjs/config";
import { ServiceUnavailableException } from "@nestjs/common";

import linesData from "../config/lines-data";
import { FakeCacheService, restoreFetch, stubFetch } from "../testing/fakes";
import { CrawlService } from "./crawl.service";

const sampleHtml = `
<html><body>
  <div class="MuiAccordion-root">
    <p><span class="sr-only">Départ</span>12:34</p>
    <p><span class="sr-only">Voie</span>2</p>
    <p><span class="sr-only">Mode</span>TER 123456</p>
    <p><span class="sr-only">Ignored</span>whatever</p>
  </div>
  <div class="MuiAccordion-root">
    <p><span class="sr-only">Départ</span>13:00</p>
  </div>
</body></html>`;

function makeService(configured = true, cache = new FakeCacheService()) {
  const config = new ConfigService(
    configured
      ? { SNCF_CRAWL_URL: "https://www.ter.sncf.com/gares" }
      : {},
  );

  return { service: new CrawlService(config, cache.asCacheService()), cache };
}

afterEach(() => {
  restoreFetch();
});

describe("CrawlService", () => {
  it("parses departures out of the schedule page HTML", () => {
    const { service } = makeService();

    const result = service.parseDeparturesFromHtml(sampleHtml);

    expect(result).toEqual([
      { departureTime: "12:34", dock: "2", trainNumber: "123456" },
      { departureTime: "13:00", dock: "", trainNumber: "" },
    ]);
  });

  it("fetches and caches departures", async () => {
    const { service, cache } = makeService();
    stubFetch(async () => new Response(sampleHtml));

    const result = await service.getDepartures(linesData[0]);

    expect(result.isCached).toBe(false);
    expect(result.data).toHaveLength(2);
    expect(cache.jsonWrites).toEqual([
      { key: `crawl:/${linesData[0].crawlUrlParam}`, ttlSeconds: 300 },
    ]);
  });

  it("caches empty parses briefly instead of the full TTL", async () => {
    const { service, cache } = makeService();
    stubFetch(async () => new Response("<html>no accordions here</html>"));

    const result = await service.getDepartures(linesData[0]);

    expect(result.data).toEqual([]);
    expect(cache.jsonWrites).toEqual([
      { key: expect.stringContaining("crawl:"), ttlSeconds: 30 },
    ]);
  });

  it("throws 503 when SNCF_CRAWL_URL is not configured", async () => {
    const { service } = makeService(false);

    expect(service.getDepartures(linesData[0])).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it("getDeparturesSafe returns an empty list when unconfigured", async () => {
    const { service } = makeService(false);

    expect(await service.getDeparturesSafe(linesData[0])).toEqual([]);
  });
});
