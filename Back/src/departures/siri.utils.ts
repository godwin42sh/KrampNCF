import { differenceInMinutes, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import type { IsCached } from "../types/IsCached";
import type { DeparturesResponse, TrainResponse } from "../types/Response";
import type { SiriBoard, SiriCall, SiriJourney } from "../types/SiriEt";

/** Departures older than this are dropped from the board. */
const PAST_GRACE_MINUTES = 2;

function findCall(calls: SiriCall[], uics: string[]): SiriCall | undefined {
  return calls.find((call) => uics.some((uic) => call.stopRef.endsWith(uic)));
}

function toParisTime(iso: string): string {
  return formatInTimeZone(iso, "Europe/Paris", "HH:mm");
}

/**
 * Build one departure board from the parsed SIRI ET journeys: keep journeys
 * that call at the board's departure stop and later at its destination stop
 * (the calling list makes stop-vs-skip unambiguous), then map the departure
 * call to a TrainResponse with delay and platform.
 */
export function buildBoardFromSiriJourneys(
  board: SiriBoard,
  journeys: IsCached<SiriJourney[]>,
  now: Date = new Date(),
): DeparturesResponse {
  const entries: { departureIso: string; train: TrainResponse }[] = [];

  for (const journey of journeys.data) {
    const fromCall = findCall(journey.calls, board.fromUics);
    const toCall = findCall(journey.calls, board.toUics);

    if (!fromCall || !toCall) continue;

    const departureIso =
      fromCall.expectedDepartureTime ?? fromCall.aimedDepartureTime;
    const toIso =
      toCall.expectedArrivalTime ??
      toCall.aimedArrivalTime ??
      toCall.expectedDepartureTime ??
      toCall.aimedDepartureTime;

    if (!departureIso || !toIso) continue;

    // Direction: the journey must depart here before reaching the other stop.
    if (parseISO(departureIso) >= parseISO(toIso)) continue;

    // Skip trains that already left.
    if (
      differenceInMinutes(parseISO(departureIso), now) < -PAST_GRACE_MINUTES
    ) {
      continue;
    }

    const arrivalIso = fromCall.expectedArrivalTime ?? fromCall.aimedArrivalTime;

    const train: TrainResponse = {
      title: board.destinationName,
      departureTime: toParisTime(departureIso),
      arrivalTime: arrivalIso ? toParisTime(arrivalIso) : toParisTime(departureIso),
      trainNumber: journey.trainNumber,
      trainType: journey.lineRef === "C" ? "RER" : "TER",
    };

    if (fromCall.aimedDepartureTime && fromCall.expectedDepartureTime) {
      const delay = differenceInMinutes(
        parseISO(fromCall.expectedDepartureTime),
        parseISO(fromCall.aimedDepartureTime),
      );
      if (delay) {
        train.delay = delay;
      }
    }

    const dock = fromCall.departurePlatform ?? fromCall.arrivalPlatform;
    if (dock) {
      train.dock = dock;
    }

    if (journey.cancelled) {
      train.deleted = true;
    }

    entries.push({ departureIso, train });
  }

  entries.sort((a, b) => a.departureIso.localeCompare(b.departureIso));

  return {
    title: `${board.departureName} - ${format(now, "dd/MM")}`,
    data: entries.map((entry) => entry.train),
    isCached: journeys.isCached,
    fetchType: "siri",
  };
}
