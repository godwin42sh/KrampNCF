import { describe, expect, it } from "bun:test";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

import linesData from "../config/lines-data";
import type { FeedMessage } from "../gtfs/gtfs.service";
import {
  getDeparturesFromLineDataRealtime,
  getDeparturesFromToRealtime,
  getDeparturesTimeWithDelayFromTimeUpdates,
  getDeparturesTimesWithDelayFromFeed,
} from "./gtfs-rt.utils";
import { makeDeparture } from "./departures.utils.spec";

const transit = GtfsRealtimeBindings.transit_realtime;

/** Epoch seconds for a local Europe/Paris date string. */
function epoch(dateStr: string): number {
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

type StopUpdate = {
  stopId: string;
  departureTime?: number;
  departureDelay?: number;
  arrivalTime?: number;
  arrivalDelay?: number;
};

export function makeFeed(trips: StopUpdate[][]): FeedMessage {
  return transit.FeedMessage.create({
    header: { gtfsRealtimeVersion: "2.0" },
    entity: trips.map((stopTimeUpdates, index) => ({
      id: `${index}`,
      tripUpdate: {
        trip: {},
        stopTimeUpdate: stopTimeUpdates.map((update) => ({
          stopId: update.stopId,
          departure: update.departureTime
            ? { time: update.departureTime, delay: update.departureDelay ?? 0 }
            : undefined,
          arrival: update.arrivalTime
            ? { time: update.arrivalTime, delay: update.arrivalDelay ?? 0 }
            : undefined,
        })),
      },
    })),
  });
}

const [etampes, austerlitz] = linesData;

describe("getDeparturesFromToRealtime", () => {
  it("extracts trips that pass from -> to, keeping the departure at from", () => {
    const feed = makeFeed([
      // a trip Étampes -> Austerlitz
      [
        {
          stopId: etampes.gtfsId,
          departureTime: epoch("2026-07-23T12:00:00+02:00"),
          arrivalTime: epoch("2026-07-23T11:59:00+02:00"),
        },
        { stopId: austerlitz.gtfsId, departureTime: epoch("2026-07-23T13:00:00+02:00") },
      ],
      // a trip that only serves Austerlitz — must be ignored
      [{ stopId: austerlitz.gtfsId, departureTime: epoch("2026-07-23T14:00:00+02:00") }],
    ]);

    const result = getDeparturesFromToRealtime(etampes, austerlitz, {
      isCached: true,
      data: feed,
    });

    expect(result.isCached).toBe(true);
    expect(result.fetchType).toBe("gtfs");
    expect(result.data).toEqual([
      {
        title: austerlitz.title,
        departureTime: "12:00",
        arrivalTime: "11:59",
        delay: undefined,
      },
    ]);
  });

  it("reports delays in minutes", () => {
    const feed = makeFeed([
      [
        {
          stopId: etampes.gtfsId,
          departureTime: epoch("2026-07-23T12:05:00+02:00"),
          departureDelay: 300,
        },
        { stopId: austerlitz.gtfsId, departureTime: epoch("2026-07-23T13:00:00+02:00") },
      ],
    ]);

    const result = getDeparturesFromToRealtime(etampes, austerlitz, {
      isCached: false,
      data: feed,
    });

    expect(result.data[0].delay).toBe(5);
  });
});

describe("getDeparturesFromLineDataRealtime", () => {
  it("collects every stop update of the line", () => {
    const feed = makeFeed([
      [{ stopId: etampes.gtfsId, departureTime: epoch("2026-07-23T12:00:00+02:00") }],
      [{ stopId: "somewhere-else", departureTime: epoch("2026-07-23T12:30:00+02:00") }],
      [{ stopId: etampes.gtfsId, departureTime: epoch("2026-07-23T13:00:00+02:00") }],
    ]);

    const result = getDeparturesFromLineDataRealtime(etampes, {
      isCached: false,
      data: feed,
    });

    expect(result.data.map((train) => train.departureTime)).toEqual([
      "12:00",
      "13:00",
    ]);
  });
});

describe("delay merge from feed onto scheduled data", () => {
  it("applies the delay when the scheduled time matches", () => {
    const feed = makeFeed([
      [
        {
          stopId: etampes.gtfsId,
          departureTime: epoch("2026-07-23T12:05:00+02:00"),
          departureDelay: 300,
        },
      ],
    ]);

    const tripsDelayed = getDeparturesTimesWithDelayFromFeed(
      feed,
      etampes.gtfsId,
    );
    expect(tripsDelayed).toHaveLength(1);

    const result = getDeparturesTimeWithDelayFromTimeUpdates(
      etampes,
      tripsDelayed,
      makeDeparture({ departureDateTime: "20260723T120000" }),
    );

    expect(result.departureTime).toBe("12:05");
    expect(result.delay).toBe(5);
  });

  it("keeps the scheduled time when nothing matches", () => {
    const result = getDeparturesTimeWithDelayFromTimeUpdates(
      etampes,
      [],
      makeDeparture({ departureDateTime: "20260723T120000" }),
    );

    expect(result.departureTime).toBe("12:00");
    expect(result.delay).toBeUndefined();
  });

  it("ignores on-time stop updates when scanning the feed", () => {
    const feed = makeFeed([
      [
        {
          stopId: etampes.gtfsId,
          departureTime: epoch("2026-07-23T12:00:00+02:00"),
        },
      ],
    ]);

    expect(getDeparturesTimesWithDelayFromFeed(feed, etampes.gtfsId)).toEqual(
      [],
    );
  });
});
