import { describe, expect, it } from "bun:test";
import { ConfigService } from "@nestjs/config";
import { NotFoundException } from "@nestjs/common";

import linesData from "../config/lines-data";
import type { CrawlFlareService } from "../crawl/crawl-flare.service";
import type { CrawlService } from "../crawl/crawl.service";
import type { GtfsService } from "../gtfs/gtfs.service";
import type { PrimService } from "../prim/prim.service";
import type { SiriEtService } from "../siri-et/siri-et.service";
import type { SncfService } from "../sncf/sncf.service";
import { TrainType } from "../types/CrawlFlareDeparture";
import { DeparturesService } from "./departures.service";
import { makeDeparture } from "./departures.utils.spec";
import { makeFlareDeparture } from "./flare.utils.spec";
import { makeFeed } from "./gtfs-rt.utils.spec";
import { makeVisit } from "./prim.utils.spec";

const lineData = linesData[0]; // Étampes
const dateFrom = new Date("2026-07-23T10:00:00");

type Stubs = {
  sncf?: Partial<SncfService>;
  gtfs?: Partial<GtfsService>;
  prim?: Partial<PrimService>;
  siriEt?: Partial<SiriEtService>;
  crawl?: Partial<CrawlService>;
  crawlFlare?: Partial<CrawlFlareService>;
  config?: Record<string, unknown>;
};

function makeService(stubs: Stubs = {}) {
  const defaults = {
    sncf: {
      getDepartures: async () => ({
        isCached: false,
        data: [makeDeparture({ departureDateTime: "20260723T120000" })],
      }),
    },
    gtfs: { getFeed: async () => null },
    prim: { getDepartures: async () => ({ isCached: false, data: [] }) },
    siriEt: { getJourneys: async () => ({ isCached: false, data: [] }) },
    crawl: {
      getDeparturesSafe: async () => [],
      getDepartures: async () => ({ isCached: false, data: [] }),
    },
    crawlFlare: { getDepartures: async () => ({ isCached: false, data: [] }) },
  };

  return new DeparturesService(
    new ConfigService(stubs.config ?? {}),
    { ...defaults.sncf, ...stubs.sncf } as SncfService,
    { ...defaults.gtfs, ...stubs.gtfs } as GtfsService,
    { ...defaults.prim, ...stubs.prim } as PrimService,
    { ...defaults.siriEt, ...stubs.siriEt } as SiriEtService,
    { ...defaults.crawl, ...stubs.crawl } as CrawlService,
    { ...defaults.crawlFlare, ...stubs.crawlFlare } as CrawlFlareService,
  );
}

describe("lookups", () => {
  it("findLineData throws 404 for an unknown id", () => {
    expect(() => makeService().findLineData(999)).toThrow(NotFoundException);
  });

  it("resolveFetchType falls back to prim and honours the env default", () => {
    expect(makeService().resolveFetchType()).toBe("prim");
    expect(makeService().resolveFetchType("crawlFlare")).toBe("crawlFlare");
    expect(makeService().resolveFetchType("bogus")).toBe("prim");
    expect(
      makeService({
        config: { DEFAULT_FETCH_RT_METHOD: "gtfs" },
      }).resolveFetchType(),
    ).toBe("gtfs");
  });
});

describe("fetchLine (gtfs)", () => {
  it("merges scheduled data with feed delays and crawl docks", async () => {
    const feed = makeFeed([
      [
        {
          stopId: lineData.gtfsId,
          departureTime: Math.floor(
            new Date("2026-07-23T12:05:00").getTime() / 1000,
          ),
          departureDelay: 300,
        },
      ],
    ]);

    const service = makeService({
      gtfs: { getFeed: async () => ({ isCached: false, data: feed }) },
      crawl: {
        getDeparturesSafe: async () => [
          { trainNumber: "123456", dock: "3", departureTime: "" },
        ],
      },
    });

    const result = await service.fetchLine(lineData, dateFrom, "gtfs");

    expect(result.fetchType).toBe("gtfs");
    expect(result.title).toBe(`${lineData.title} - 23/07`);
    expect(result.data).toEqual([
      {
        title: lineData.destinationName,
        arrivalTime: "12:00",
        departureTime: "12:05",
        trainNumber: "123456",
        delay: 5,
        dock: "3",
      },
    ]);
  });

  it("returns an empty response when the feed is unavailable", async () => {
    const service = makeService();

    const result = await service.fetchLine(lineData, dateFrom, "gtfs");

    expect(result.data).toEqual([]);
  });
});

describe("fetchLine (prim)", () => {
  it("merges scheduled data with PRIM delays", async () => {
    const service = makeService({
      prim: {
        getDepartures: async () => ({
          isCached: false,
          data: [
            {
              MonitoredStopVisit: [
                makeVisit({
                  trainNumber: "123456",
                  aimedDeparture: "2026-07-23T12:00:00+02:00",
                  expectedDeparture: "2026-07-23T12:03:00+02:00",
                }),
              ],
            },
          ] as never,
        }),
      },
    });

    const result = await service.fetchLine(lineData, dateFrom, "prim");

    expect(result.fetchType).toBe("prim");
    expect(result.data[0]).toMatchObject({
      departureTime: "12:03",
      delay: 3,
    });
  });

  it("degrades to scheduled-only when PRIM is unconfigured", async () => {
    const service = makeService({
      prim: {
        getDepartures: async () => {
          throw new Error("not configured");
        },
      },
    });

    const result = await service.fetchLine(lineData, dateFrom, "prim");

    expect(result.data).toEqual([]);
  });
});

describe("fetchLine (crawlFlare)", () => {
  it("overlays crawled realtime data on the schedule", async () => {
    const service = makeService({
      crawlFlare: {
        getDepartures: async () => ({
          isCached: false,
          data: [
            makeFlareDeparture({
              trainNumber: "123456",
              trainStatus: "RETARD",
              delay: 7,
              actualTime: "2026-07-23T12:07:00",
              track: "B",
            }),
          ],
        }),
      },
    });

    const result = await service.fetchLine(lineData, dateFrom, "crawlFlare");

    expect(result.fetchType).toBe("crawlFlare");
    expect(result.data[0]).toMatchObject({
      departureTime: "12:07",
      delay: 7,
      dock: "B",
    });
  });
});

describe("fetchAllLines", () => {
  it("returns one response per configured line", async () => {
    const service = makeService();

    const result = await service.fetchAllLines(dateFrom, "crawlFlare");

    expect(result).toHaveLength(linesData.length);
  });

  it("keeps only the board departing from ?from=", async () => {
    const service = makeService();

    const result = await service.fetchAllLines(dateFrom, "crawlFlare", "etampes");

    expect(result).toHaveLength(1);
    expect(result[0].title).toStartWith("Étampes");
  });

  it("throws 404 when no board departs from the requested station", () => {
    expect(
      makeService().fetchAllLines(dateFrom, "crawlFlare", "lyon"),
    ).rejects.toThrow(NotFoundException);
  });
});

describe("getSiriBoardsByType", () => {
  it("filters boards by departure station", async () => {
    const service = makeService();

    const result = await service.getSiriBoardsByType("train", "austerlitz");

    expect(result).toHaveLength(1);
    expect(result[0].title).toContain("Austerlitz");
  });
});

describe("getCrawlDeparturesBoard", () => {
  it("shapes the raw crawl as a departures board", async () => {
    const service = makeService({
      crawl: {
        getDepartures: async () => ({
          isCached: true,
          data: [{ trainNumber: "111", dock: "3", departureTime: "12:00" }],
        }),
      },
    });

    const result = await service.getCrawlDeparturesBoard(1);

    expect(result).toEqual({
      title: lineData.title,
      fetchType: "crawl",
      isCached: true,
      data: [
        {
          title: lineData.destinationName,
          departureTime: "12:00",
          trainNumber: "111",
          dock: "3",
        },
      ],
    });
  });
});

describe("getCrawlFlareDepartures", () => {
  it("throws 404 for an unknown crawl id", () => {
    expect(makeService().getCrawlFlareDepartures(999)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("filters by train type", async () => {
    const service = makeService({
      crawlFlare: {
        getDepartures: async () => ({
          isCached: false,
          data: [
            makeFlareDeparture({ trainType: TrainType.Ter }),
            makeFlareDeparture({ trainType: TrainType.Rer }),
          ],
        }),
      },
    });

    const result = await service.getCrawlFlareDepartures(1, TrainType.Rer);

    expect(result.title).toContain(TrainType.Rer);
    expect(result.data).toHaveLength(1);
  });
});
