import { differenceInMinutes, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import type { Departure } from "../types/Departure";
import type { IsCached } from "../types/IsCached";
import type { LineData } from "../types/LineData";
import type { PrimData } from "../types/PrimData";
import type {
  MonitoredStopVisit,
  StopMonitoringDelivery,
} from "../types/PrimSNCF";
import type { DeparturesResponse, TrainResponse } from "../types/Response";

/** PRIM returns the literal "unknown" for platforms not yet assigned. */
function normalizeDock(value?: string): string | undefined {
  if (!value || value.toLowerCase() === "unknown") {
    return undefined;
  }
  return value;
}

/** Map an IDFM LineRef to a coarse train type (drives the awtrix icon). */
const LINE_REF_TO_TRAIN_TYPE: Record<string, string> = {
  "STIF:Line::C01727:": "RER", // RER C
  "STIF:Line::C01857:": "TER", // TER Paris-Austerlitz – Étampes – Orléans
};

function trainTypeFromLineRef(lineRef?: string): string | undefined {
  return lineRef ? LINE_REF_TO_TRAIN_TYPE[lineRef] : undefined;
}

export function buildDepartureFromStops(
  primData: PrimData,
  visits: MonitoredStopVisit[],
  trainNumbersFilter: string[],
): TrainResponse[] {
  const res: TrainResponse[] = [];

  visits.forEach((visit) => {
    const journey = visit.MonitoredVehicleJourney;

    // Direction filter: keep only trains heading the way we care about.
    const destinationName = journey.DestinationName?.[0]?.value;
    if (
      primData.destinationMatch.length &&
      (!destinationName || !primData.destinationMatch.includes(destinationName))
    ) {
      return;
    }
    if (
      primData.primLineRefs &&
      !primData.primLineRefs.includes(journey.LineRef.value)
    ) {
      return;
    }
    if (
      primData.primJourneyNote &&
      !primData.primJourneyNote.includes(journey.JourneyNote?.[0]?.value)
    ) {
      return;
    }
    if (
      trainNumbersFilter.length &&
      !trainNumbersFilter.includes(journey.TrainNumbers.TrainNumberRef[0].value)
    ) {
      return;
    }

    const monitoredCall = journey.MonitoredCall;
    const arrivalTimeRaw = monitoredCall.ExpectedArrivalTime;
    const departureTimeRaw =
      monitoredCall.ExpectedDepartureTime ?? monitoredCall.AimedDepartureTime;

    if (!departureTimeRaw) {
      return;
    }

    const departureTime = formatInTimeZone(
      departureTimeRaw,
      "Europe/Paris",
      "HH:mm",
    );
    const arrivalTime = arrivalTimeRaw
      ? formatInTimeZone(arrivalTimeRaw, "Europe/Paris", "HH:mm")
      : departureTime;

    const tmp: TrainResponse = {
      title: primData.destinationName,
      departureTime,
      arrivalTime,
      trainNumber: journey.TrainNumbers.TrainNumberRef[0].value,
      trainType: trainTypeFromLineRef(journey.LineRef?.value),
    };

    if (monitoredCall.AimedDepartureTime && monitoredCall.ExpectedDepartureTime) {
      const delay = differenceInMinutes(
        parseISO(monitoredCall.ExpectedDepartureTime),
        parseISO(monitoredCall.AimedDepartureTime),
      );

      if (delay) {
        tmp.delay = delay;
      }
    }

    const dock = normalizeDock(monitoredCall.ArrivalPlatformName?.value);
    if (dock) {
      tmp.dock = dock;
    }

    res.push(tmp);
  });

  return res;
}

export function parsePrimDeliveries(
  primData: PrimData,
  deliveries: IsCached<StopMonitoringDelivery[]>,
  trainNumbersFilter: string[] = [],
): DeparturesResponse | false {
  if (deliveries.data.length === 0) {
    return false;
  }

  // flatMap instead of repeated array spreads (§4.2 of the optimization report)
  const data = deliveries.data.flatMap((delivery) =>
    buildDepartureFromStops(
      primData,
      delivery.MonitoredStopVisit,
      trainNumbersFilter,
    ),
  );

  return {
    title: `${primData.departureName} - ${format(new Date(), "dd/MM")}`,
    data,
    isCached: deliveries.isCached,
    fetchType: "prim",
  };
}

function mergePrimAndScheduled(
  primVisit: MonitoredStopVisit,
  scheduled: TrainResponse,
  initialDepartureDate: Date,
): TrainResponse {
  const monitoredCall = primVisit.MonitoredVehicleJourney.MonitoredCall;
  const primDepartureTimeRaw =
    monitoredCall.ExpectedDepartureTime ?? monitoredCall.AimedDepartureTime;

  const primDock = normalizeDock(monitoredCall.ArrivalPlatformName?.value);
  const resInit = primDock ? { ...scheduled, dock: primDock } : scheduled;

  if (!primDepartureTimeRaw) {
    return resInit;
  }

  const delay = differenceInMinutes(
    new Date(primDepartureTimeRaw),
    initialDepartureDate,
  );

  if (delay === 0) {
    return resInit;
  }

  const departureTime = formatInTimeZone(
    primDepartureTimeRaw,
    "Europe/Paris",
    "HH:mm",
  );
  const arrivalTimeRaw = monitoredCall.ExpectedArrivalTime;
  const arrivalTime = arrivalTimeRaw
    ? formatInTimeZone(arrivalTimeRaw, "Europe/Paris", "HH:mm")
    : departureTime;

  return {
    ...scheduled,
    arrivalTime,
    departureTime,
    delay,
    dock: primDock,
  };
}

export function getDeparturesFromScheduledAndPrim(
  lineData: LineData,
  departure: Departure,
  primFetchedData: MonitoredStopVisit[],
): TrainResponse {
  const arrivalDate = parseISO(departure.stop_date_time.arrival_date_time);
  const departureDate = parseISO(departure.stop_date_time.departure_date_time);

  const res: TrainResponse = {
    title: lineData.destinationName,
    arrivalTime: format(arrivalDate, "HH:mm"),
    departureTime: format(departureDate, "HH:mm"),
    trainNumber: departure.display_informations.trip_short_name,
  };

  const primMatching = primFetchedData.find(
    (visit) =>
      res.trainNumber ===
      visit.MonitoredVehicleJourney.TrainNumbers.TrainNumberRef[0].value,
  );

  if (!primMatching) {
    return res;
  }

  return mergePrimAndScheduled(primMatching, res, departureDate);
}
