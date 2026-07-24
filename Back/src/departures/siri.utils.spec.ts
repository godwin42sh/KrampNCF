import { describe, expect, it } from "bun:test";

import siriBoards from "../config/siri-data";
import type { SiriJourney } from "../types/SiriEt";
import { buildBoardFromSiriJourneys } from "./siri.utils";

const NOW = new Date("2026-07-24T14:00:00Z"); // 16:00 Paris

const etampesBoard = siriBoards[0]; // Étampes -> Austerlitz
const austerlitzBoard = siriBoards[1]; // Austerlitz -> Étampes

function journey(over: Partial<SiriJourney> & { calls: SiriJourney["calls"] }): SiriJourney {
  return { cancelled: false, ...over };
}

// RER C: Austerlitz -> Étampes, 2 min delay, platform 3
const rerCsouth = journey({
  trainNumber: "145435",
  lineRef: "C",
  destinationName: "Saint-Martin d'Étampes",
  calls: [
    {
      stopRef: "FR:ScheduledStopPoint::87547026",
      aimedDepartureTime: "2026-07-24T14:30:00Z",
      expectedDepartureTime: "2026-07-24T14:32:00Z",
      departurePlatform: "3",
    },
    {
      stopRef: "FR:ScheduledStopPoint::87545137",
      expectedArrivalTime: "2026-07-24T15:29:00Z",
    },
  ],
});

// Rémi: Étampes -> Austerlitz, platform 4
const remiNorth = journey({
  trainNumber: "860500",
  lineRef: "FR:Line::X:",
  destinationName: "Paris Austerlitz",
  calls: [
    {
      stopRef: "FR:ScheduledStopPoint::87545137",
      aimedDepartureTime: "2026-07-24T14:20:00Z",
      expectedDepartureTime: "2026-07-24T14:20:00Z",
      departurePlatform: "4",
    },
    {
      stopRef: "FR:ScheduledStopPoint::87547000",
      expectedArrivalTime: "2026-07-24T15:20:00Z",
    },
  ],
});

describe("buildBoardFromSiriJourneys", () => {
  it("builds the Austerlitz→Étampes board with delay, platform and type", () => {
    const res = buildBoardFromSiriJourneys(
      austerlitzBoard,
      { isCached: false, data: [rerCsouth, remiNorth] },
      NOW,
    );

    expect(res.fetchType).toBe("siri");
    expect(res.title).toContain("Austerlitz");
    expect(res.data).toHaveLength(1); // only the southbound RER C
    expect(res.data[0]).toMatchObject({
      title: "Étampes",
      departureTime: "16:32",
      delay: 2,
      dock: "3",
      trainType: "RER",
      trainNumber: "145435",
    });
  });

  it("builds the Étampes→Austerlitz board (opposite direction)", () => {
    const res = buildBoardFromSiriJourneys(
      etampesBoard,
      { isCached: true, data: [rerCsouth, remiNorth] },
      NOW,
    );

    expect(res.isCached).toBe(true);
    expect(res.data).toHaveLength(1); // only the northbound Rémi
    expect(res.data[0]).toMatchObject({
      departureTime: "16:20",
      dock: "4",
      trainType: "TER",
    });
  });

  it("excludes a train that does not call at the destination stop", () => {
    // Orléans express: departs Austerlitz but never calls at Étampes
    const express = journey({
      trainNumber: "860999",
      destinationName: "Orléans",
      calls: [
        {
          stopRef: "FR:ScheduledStopPoint::87547000",
          expectedDepartureTime: "2026-07-24T14:40:00Z",
        },
        {
          stopRef: "FR:ScheduledStopPoint::87999999",
          expectedArrivalTime: "2026-07-24T15:40:00Z",
        },
      ],
    });

    const res = buildBoardFromSiriJourneys(
      austerlitzBoard,
      { isCached: false, data: [express] },
      NOW,
    );

    expect(res.data).toHaveLength(0);
  });

  it("drops departures already in the past", () => {
    const res = buildBoardFromSiriJourneys(
      austerlitzBoard,
      { isCached: false, data: [rerCsouth] },
      new Date("2026-07-24T15:00:00Z"), // 17:00 Paris, well after 16:32
    );

    expect(res.data).toHaveLength(0);
  });

  it("flags a cancelled journey as deleted", () => {
    const res = buildBoardFromSiriJourneys(
      austerlitzBoard,
      { isCached: false, data: [{ ...rerCsouth, cancelled: true }] },
      NOW,
    );

    expect(res.data[0].deleted).toBe(true);
  });
});
