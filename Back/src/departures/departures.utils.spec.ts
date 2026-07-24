import { describe, expect, it } from "bun:test";

import linesData from "../config/lines-data";
import type { Departure } from "../types/Departure";
import type { TrainResponse } from "../types/Response";
import {
  addDockToTrainResponses,
  filterScheduledDepartures,
  getDateFromQuery,
  parseScheduledData,
  subtractHours,
} from "./departures.utils";

export function makeDeparture(overrides: {
  directionId?: string;
  departureDateTime?: string;
  arrivalDateTime?: string;
  tripShortName?: string;
}): Departure {
  return {
    display_informations: {
      trip_short_name: overrides.tripShortName ?? "123456",
    },
    route: {
      direction: {
        id: overrides.directionId ?? linesData[0].directionAreaId,
      },
    },
    stop_date_time: {
      departure_date_time: overrides.departureDateTime ?? "20260723T120000",
      arrival_date_time:
        overrides.arrivalDateTime ??
        overrides.departureDateTime ??
        "20260723T115900",
    },
  } as Departure;
}

describe("subtractHours", () => {
  it("does not mutate its argument", () => {
    const date = new Date("2026-07-23T12:00:00Z");
    const before = date.getTime();

    const result = subtractHours(date, 2);

    expect(date.getTime()).toBe(before);
    expect(result.getTime()).toBe(before - 2 * 3_600_000);
  });
});

describe("getDateFromQuery", () => {
  it("parses a valid ISO date", () => {
    const result = getDateFromQuery("2026-07-23T10:00:00Z");

    expect(result).not.toBe(false);
    expect((result as Date).toISOString()).toBe("2026-07-23T10:00:00.000Z");
  });

  it("returns false for an invalid date", () => {
    expect(getDateFromQuery("notadate")).toBe(false);
  });

  it("defaults to one hour ago", () => {
    const result = getDateFromQuery(undefined) as Date;

    expect(Math.abs(Date.now() - 3_600_000 - result.getTime())).toBeLessThan(
      5_000,
    );
  });
});

describe("filterScheduledDepartures", () => {
  const lineData = linesData[0];
  const dateFrom = new Date("2026-07-23T10:00:00");

  it("keeps departures matching direction and day", () => {
    const keep = makeDeparture({});
    const wrongDirection = makeDeparture({ directionId: "stop_area:other" });
    const wrongDay = makeDeparture({ departureDateTime: "20260724T120000" });

    const result = filterScheduledDepartures(lineData, dateFrom, [
      keep,
      wrongDirection,
      wrongDay,
    ]);

    expect(result).toEqual([keep]);
  });
});

describe("parseScheduledData", () => {
  it("formats times and picks the train number", () => {
    const result = parseScheduledData(linesData[0], [
      makeDeparture({
        departureDateTime: "20260723T120500",
        arrivalDateTime: "20260723T120400",
        tripShortName: "654321",
      }),
    ]);

    expect(result).toEqual([
      {
        title: linesData[0].destinationName,
        arrivalTime: "12:04",
        departureTime: "12:05",
        trainNumber: "654321",
      },
    ]);
  });
});

describe("addDockToTrainResponses", () => {
  const trains: TrainResponse[] = [
    { title: "A", departureTime: "12:00", trainNumber: "111" },
    { title: "B", departureTime: "13:00", trainNumber: "222" },
  ];

  it("merges the dock for matching train numbers", () => {
    const result = addDockToTrainResponses(trains, [
      { trainNumber: "222", dock: "3", departureTime: "" },
    ]);

    expect(result[0].dock).toBeUndefined();
    expect(result[1].dock).toBe("3");
  });

  it("returns the input untouched when there is no crawl data", () => {
    expect(addDockToTrainResponses(trains, [])).toBe(trains);
  });

  it("ignores matches without a dock", () => {
    const result = addDockToTrainResponses(trains, [
      { trainNumber: "111", dock: "", departureTime: "" },
    ]);

    expect(result[0].dock).toBeUndefined();
  });
});
