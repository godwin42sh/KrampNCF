import { differenceInMinutes, format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { MonitoredStopVisit } from '../types/PrimSNCF';
import type { RTFetchType } from '../types/RTFetchType';
import type { Departure } from '../types/Departure';
import type { LineData } from '../types/LineData';
import type { PrimData } from '../types/PrimData';

import { Prim } from '../services/prim-api';
import { DeparturesResponse, TrainResponse } from '../types/Response';

function buildDepartureFromStops(
  primData: PrimData,
  visits: MonitoredStopVisit[],
  trainNumbersFilter: string[],
) {
  const res: TrainResponse[] = [];

  visits.forEach((visit) => {
    if (primData.primDestinationRef
      && visit.MonitoredVehicleJourney.DestinationRef.value !== primData.primDestinationRef) {
      return;
    }
    if (visit.MonitoredVehicleJourney.LineRef.value !== primData.primLineRef) {
      return;
    }

    if (primData.primJourneyNote
      && !primData.primJourneyNote.includes(visit.MonitoredVehicleJourney.JourneyNote[0].value)) {
      return;
    }

    if (trainNumbersFilter.length
      && !trainNumbersFilter.includes(
        visit.MonitoredVehicleJourney.TrainNumbers.TrainNumberRef[0].value,
      )
    ) {
      return;
    }

    const arrivalTimeRaw = visit.MonitoredVehicleJourney.MonitoredCall.ExpectedArrivalTime;
    const departureTimeRaw = visit.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime
      ?? visit.MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime;

    if (!departureTimeRaw) {
      return;
    }

    const departureTime = formatInTimeZone(
      departureTimeRaw,
      'Europe/Paris',
      'HH:mm',
    );
    const arrivalTime = arrivalTimeRaw ? formatInTimeZone(
      arrivalTimeRaw,
      'Europe/Paris',
      'HH:mm',
    ) : departureTime;

    const tmp: Partial<TrainResponse> = {
      title: primData.destinationName,
      departureTime,
      arrivalTime,
      trainNumber: visit.MonitoredVehicleJourney.TrainNumbers.TrainNumberRef[0].value,
    };

    let delay = 0;

    if (visit.MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime
    && visit.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime) {
      delay = differenceInMinutes(
        parseISO(visit.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime),
        parseISO(visit.MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime),
      );
    }

    if (delay) {
      tmp.delay = delay;
    }

    if (visit.MonitoredVehicleJourney.MonitoredCall.ArrivalPlatformName?.value) {
      tmp.dock = visit.MonitoredVehicleJourney.MonitoredCall.ArrivalPlatformName?.value;
    }

    res.push(tmp as TrainResponse);
  });

  return res;
}

export async function getDeparturesFromPrim(
  primData: PrimData,
  trainNumbersFilter: string[] = [],
): Promise<false | DeparturesResponse> {
  const prim = new Prim(
    process.env.SNCF_API_PRIM_URL as string,
    process.env.SNCF_API_PRIM_KEY as string,
  );

  const departuresFrom = await prim.getDepartures(primData);

  if (departuresFrom.data.length === 0) {
    return false;
  }

  let res: TrainResponse[] = [];

  departuresFrom.data.forEach((departure) => {
    res = [
      ...res,
      ...buildDepartureFromStops(
        primData,
        departure.MonitoredStopVisit,
        trainNumbersFilter,
      ),
    ];
  });

  const dateNow = new Date();

  return {
    title: `${primData.departureName} - ${format(dateNow, 'dd/MM')}`,
    data: res,
    isCached: departuresFrom.isCached,
    fetchType: 'prim' as RTFetchType,
  };
}

function mergePrimAndScheduled(
  primVisit: MonitoredStopVisit,
  scheduled: TrainResponse,
  initialDepartureDate: Date,
): TrainResponse {
  const primDepartureTimeRaw = primVisit.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime
    ?? primVisit.MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime;

  const resInit = primVisit.MonitoredVehicleJourney.MonitoredCall.ArrivalPlatformName?.value
    ? {
      ...scheduled,
      dock: primVisit.MonitoredVehicleJourney.MonitoredCall.ArrivalPlatformName?.value,
    }
    : scheduled;

  if (!primDepartureTimeRaw) {
    return resInit;
  }

  const delay = differenceInMinutes(new Date(primDepartureTimeRaw), initialDepartureDate);

  if (delay === 0) {
    return resInit;
  }

  const departureTime = formatInTimeZone(
    primDepartureTimeRaw,
    'Europe/Paris',
    'HH:mm',
  );
  const arrivalTimeRaw = primVisit.MonitoredVehicleJourney.MonitoredCall.ExpectedArrivalTime;
  const arrivalTime = arrivalTimeRaw ? formatInTimeZone(
    arrivalTimeRaw,
    'Europe/Paris',
    'HH:mm',
  ) : departureTime;

  return {
    ...scheduled,
    arrivalTime,
    departureTime,
    delay,
    dock: primVisit.MonitoredVehicleJourney.MonitoredCall.ArrivalPlatformName?.value,
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
    arrivalTime: format(arrivalDate, 'HH:mm'),
    departureTime: format(departureDate, 'HH:mm'),
    trainNumber: departure.display_informations.trip_short_name,
  };

  const primMatching = primFetchedData.find(
    (visit) => res.trainNumber
      === visit.MonitoredVehicleJourney.TrainNumbers.TrainNumberRef[0].value,
  );

  if (!primMatching) {
    return res;
  }

  return mergePrimAndScheduled(primMatching, res, departureDate);
}
