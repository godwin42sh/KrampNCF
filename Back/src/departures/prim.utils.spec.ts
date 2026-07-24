import { describe, expect, it } from "bun:test";

import primsData from "../config/prim-data";
import linesData from "../config/lines-data";
import type { MonitoredStopVisit } from "../types/PrimSNCF";
import {
  buildDepartureFromStops,
  getDeparturesFromScheduledAndPrim,
  parsePrimDeliveries,
} from "./prim.utils";
import { makeDeparture } from "./departures.utils.spec";

export function makeVisit(overrides: {
  lineRef?: string;
  destinationName?: string;
  journeyNote?: string;
  trainNumber?: string;
  aimedDeparture?: string;
  expectedDeparture?: string;
  expectedArrival?: string;
  platform?: string;
}): MonitoredStopVisit {
  return {
    MonitoredVehicleJourney: {
      LineRef: { value: overrides.lineRef ?? "STIF:Line::C01727:" },
      DestinationName: [
        { value: overrides.destinationName ?? "Paris Austerlitz" },
      ],
      JourneyNote: overrides.journeyNote
        ? [{ value: overrides.journeyNote }]
        : [],
      TrainNumbers: {
        TrainNumberRef: [{ value: overrides.trainNumber ?? "123456" }],
      },
      MonitoredCall: {
        AimedDepartureTime: overrides.aimedDeparture,
        ExpectedDepartureTime: overrides.expectedDeparture,
        ExpectedArrivalTime: overrides.expectedArrival,
        ArrivalPlatformName: overrides.platform
          ? { value: overrides.platform }
          : undefined,
      },
    },
  } as unknown as MonitoredStopVisit;
}

const primData = primsData[0]; // Étampes, destinationMatch ["Paris Austerlitz"]

describe("buildDepartureFromStops", () => {
  it("builds a train response with delay and dock", () => {
    const result = buildDepartureFromStops(
      primData,
      [
        makeVisit({
          aimedDeparture: "2026-07-23T12:00:00+02:00",
          expectedDeparture: "2026-07-23T12:07:00+02:00",
          expectedArrival: "2026-07-23T12:06:00+02:00",
          platform: "3",
        }),
      ],
      [],
    );

    expect(result).toEqual([
      {
        title: primData.destinationName,
        departureTime: "12:07",
        arrivalTime: "12:06",
        trainNumber: "123456",
        trainType: "RER",
        delay: 7,
        dock: "3",
      },
    ]);
  });

  it("maps the line ref to a train type", () => {
    const [rer] = buildDepartureFromStops(
      primData,
      [
        makeVisit({
          lineRef: "STIF:Line::C01857:",
          expectedDeparture: "2026-07-23T12:00:00+02:00",
        }),
      ],
      [],
    );

    expect(rer.trainType).toBe("TER");
  });

  it("drops an 'unknown' platform instead of showing it as a dock", () => {
    const result = buildDepartureFromStops(
      primData,
      [
        makeVisit({
          expectedDeparture: "2026-07-23T12:00:00+02:00",
          platform: "unknown",
        }),
      ],
      [],
    );

    expect(result).toHaveLength(1);
    expect(result[0].dock).toBeUndefined();
  });

  it("filters out other directions by destination name", () => {
    const result = buildDepartureFromStops(
      primData,
      [
        makeVisit({
          destinationName: "Saint-Martin d'Étampes", // wrong direction
          expectedDeparture: "2026-07-23T12:00:00+02:00",
        }),
        makeVisit({
          destinationName: "Paris Austerlitz", // kept
          expectedDeparture: "2026-07-23T12:10:00+02:00",
        }),
      ],
      [],
    );

    expect(result).toHaveLength(1);
    expect(result[0].departureTime).toBe("12:10");
  });

  it("filters by line when primLineRefs is set", () => {
    const terOnly = { ...primData, primLineRefs: ["STIF:Line::C01857:"] };

    const result = buildDepartureFromStops(
      terOnly,
      [
        makeVisit({
          lineRef: "STIF:Line::C01727:", // RER C, excluded
          expectedDeparture: "2026-07-23T12:00:00+02:00",
        }),
        makeVisit({
          lineRef: "STIF:Line::C01857:", // TER, kept
          expectedDeparture: "2026-07-23T12:10:00+02:00",
        }),
      ],
      [],
    );

    expect(result).toHaveLength(1);
    expect(result[0].departureTime).toBe("12:10");
  });

  it("filters by journey note when configured", () => {
    const noteData = { ...primData, primJourneyNote: ["SARA", "ORET", "VETO"] };

    const result = buildDepartureFromStops(
      noteData,
      [
        makeVisit({
          journeyNote: "SARA",
          expectedDeparture: "2026-07-23T12:00:00+02:00",
        }),
        makeVisit({
          journeyNote: "NOPE",
          expectedDeparture: "2026-07-23T12:10:00+02:00",
        }),
      ],
      [],
    );

    expect(result).toHaveLength(1);
    expect(result[0].departureTime).toBe("12:00");
  });

  it("filters by train number when a filter is given", () => {
    const result = buildDepartureFromStops(
      primData,
      [
        makeVisit({
          trainNumber: "111",
          expectedDeparture: "2026-07-23T12:00:00+02:00",
        }),
        makeVisit({
          trainNumber: "222",
          expectedDeparture: "2026-07-23T12:10:00+02:00",
        }),
      ],
      ["222"],
    );

    expect(result).toHaveLength(1);
    expect(result[0].trainNumber).toBe("222");
  });

  it("skips visits without any departure time", () => {
    const result = buildDepartureFromStops(primData, [makeVisit({})], []);

    expect(result).toEqual([]);
  });
});

describe("parsePrimDeliveries", () => {
  it("returns false when there is no delivery", () => {
    expect(
      parsePrimDeliveries(primData, { isCached: false, data: [] }),
    ).toBe(false);
  });

  it("flattens all deliveries into one response", () => {
    const visit = makeVisit({
      expectedDeparture: "2026-07-23T12:00:00+02:00",
    });

    const result = parsePrimDeliveries(primData, {
      isCached: true,
      data: [
        { MonitoredStopVisit: [visit] },
        { MonitoredStopVisit: [visit] },
      ] as never,
    });

    expect(result).not.toBe(false);
    if (result === false) return;
    expect(result.data).toHaveLength(2);
    expect(result.isCached).toBe(true);
    expect(result.fetchType).toBe("prim");
  });
});

describe("getDeparturesFromScheduledAndPrim", () => {
  const lineData = linesData[0];

  it("returns the scheduled data when no visit matches", () => {
    const result = getDeparturesFromScheduledAndPrim(
      lineData,
      makeDeparture({ tripShortName: "654321" }),
      [makeVisit({ trainNumber: "111111" })],
    );

    expect(result.trainNumber).toBe("654321");
    expect(result.delay).toBeUndefined();
  });

  it("merges the delay from a matching PRIM visit", () => {
    const result = getDeparturesFromScheduledAndPrim(
      lineData,
      makeDeparture({
        tripShortName: "123456",
        departureDateTime: "20260723T120000",
      }),
      [
        makeVisit({
          trainNumber: "123456",
          aimedDeparture: "2026-07-23T12:00:00+02:00",
          expectedDeparture: "2026-07-23T12:04:00+02:00",
          platform: "2",
        }),
      ],
    );

    expect(result).toMatchObject({
      departureTime: "12:04",
      delay: 4,
      dock: "2",
    });
  });

  it("only adds the dock when the train is on time", () => {
    const result = getDeparturesFromScheduledAndPrim(
      lineData,
      makeDeparture({
        tripShortName: "123456",
        departureDateTime: "20260723T120000",
      }),
      [
        makeVisit({
          trainNumber: "123456",
          aimedDeparture: "2026-07-23T12:00:00+02:00",
          expectedDeparture: "2026-07-23T12:00:00+02:00",
          platform: "4",
        }),
      ],
    );

    expect(result.departureTime).toBe("12:00");
    expect(result.delay).toBeUndefined();
    expect(result.dock).toBe("4");
  });
});
