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

export function buildDepartureFromStops(
  primData: PrimData,
  visits: MonitoredStopVisit[],
  trainNumbersFilter: string[],
): TrainResponse[] {
  const res: TrainResponse[] = [];

  visits.forEach((visit) => {
    const journey = visit.MonitoredVehicleJourney;

    if (
      primData.primDestinationRef &&
      journey.DestinationRef.value !== primData.primDestinationRef
    ) {
      return;
    }
    if (journey.LineRef.value !== primData.primLineRef) {
      return;
    }
    if (
      primData.primJourneyNote &&
      !primData.primJourneyNote.includes(journey.JourneyNote[0]?.value)
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

    if (monitoredCall.ArrivalPlatformName?.value) {
      tmp.dock = monitoredCall.ArrivalPlatformName.value;
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

  const resInit = monitoredCall.ArrivalPlatformName?.value
    ? { ...scheduled, dock: monitoredCall.ArrivalPlatformName.value }
    : scheduled;

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
    dock: monitoredCall.ArrivalPlatformName?.value,
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
