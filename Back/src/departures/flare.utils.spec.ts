import { describe, expect, it } from "bun:test";

import crawlsData from "../config/crawl-data";
import type { CrawlFlareDeparture } from "../types/CrawlFlareDeparture";
import { TrainType } from "../types/CrawlFlareDeparture";
import type { TrainResponse } from "../types/Response";
import {
  mergeCrawlFlareWithScheduledData,
  parseCrawlFlareDepartures,
  parseCrawlFlareDeparturesWithTitle,
} from "./flare.utils";

export function makeFlareDeparture(overrides: {
  trainNumber?: string;
  missionCode?: string | null;
  actualTime?: string;
  trainType?: TrainType;
  trainStatus?: string;
  delay?: number | null;
  track?: string | null;
  destination?: string;
  stops?: string[];
}): CrawlFlareDeparture {
  return {
    trainNumber: overrides.trainNumber ?? "123456",
    missionCode: overrides.missionCode ?? null,
    actualTime: overrides.actualTime ?? "2026-07-23T12:05:00",
    scheduledTime: "2026-07-23T12:00:00",
    trainType: overrides.trainType ?? TrainType.Ter,
    informationStatus: {
      trainStatus: overrides.trainStatus ?? "Ontime",
      eventLevel: "Normal",
      delay: overrides.delay ?? null,
    },
    platform: { track: overrides.track ?? null },
    traffic: { destination: overrides.destination ?? "Paris Austerlitz" },
    stops: overrides.stops ?? ["Paris Austerlitz"],
  } as unknown as CrawlFlareDeparture;
}

const crawlData = crawlsData[0]; // Étampes -> Austerlitz

describe("parseCrawlFlareDepartures", () => {
  it("keeps only departures whose destination is watched", () => {
    const result = parseCrawlFlareDepartures(crawlData, {
      isCached: false,
      data: [
        makeFlareDeparture({}),
        makeFlareDeparture({ destination: "Nowhere" }),
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe(crawlData.destinationName);
    expect(result[0].departureTime).toBe("12:05");
  });

  it("filters by train type", () => {
    const result = parseCrawlFlareDepartures(
      crawlData,
      {
        isCached: false,
        data: [
          makeFlareDeparture({ trainType: TrainType.Rer }),
          makeFlareDeparture({ trainType: TrainType.Ter }),
        ],
      },
      TrainType.Ter,
    );

    expect(result).toHaveLength(1);
    expect(result[0].trainType).toBe(TrainType.Ter);
  });

  it("maps delay, cancellation, dock and mission code", () => {
    const result = parseCrawlFlareDepartures(crawlData, {
      isCached: false,
      data: [
        makeFlareDeparture({
          trainStatus: "RETARD",
          delay: 10,
          track: "2",
          missionCode: "SARA",
        }),
        makeFlareDeparture({ trainStatus: "SUPPRESSION_TOTALE" }),
      ],
    });

    expect(result[0]).toMatchObject({
      delay: 10,
      dock: "2",
      trainNumber: "SARA",
      deleted: false,
    });
    expect(result[1].deleted).toBe(true);
    expect(result[1].delay).toBeUndefined();
  });
});

describe("parseCrawlFlareDeparturesWithTitle", () => {
  it("uses the train type in the title when filtering", () => {
    const result = parseCrawlFlareDeparturesWithTitle(
      crawlData,
      { isCached: true, data: [] },
      TrainType.Ter,
    );

    expect(result.title).toBe(`${crawlData.title} - ${TrainType.Ter}`);
    expect(result.isCached).toBe(true);
    expect(result.fetchType).toBe("crawlFlare");
  });
});

describe("mergeCrawlFlareWithScheduledData", () => {
  const scheduled: TrainResponse[] = [
    { title: "Austerlitz", departureTime: "12:00", trainNumber: "123456" },
    { title: "Austerlitz", departureTime: "13:00", trainNumber: "999999" },
  ];

  it("overlays realtime data on matching scheduled trains", () => {
    const result = mergeCrawlFlareWithScheduledData(
      scheduled,
      [
        makeFlareDeparture({
          trainNumber: "123456",
          trainStatus: "RETARD",
          delay: 5,
          actualTime: "2026-07-23T12:05:00",
        }),
      ],
      crawlData,
    );

    expect(result[0]).toMatchObject({ departureTime: "12:05", delay: 5 });
    expect(result[1]).toBe(scheduled[1]);
  });

  it("leaves scheduled data untouched when the crawl stop does not match", () => {
    const result = mergeCrawlFlareWithScheduledData(
      scheduled,
      [makeFlareDeparture({ trainNumber: "123456", stops: ["Elsewhere"] })],
      crawlData,
    );

    expect(result[0]).toBe(scheduled[0]);
  });
});
