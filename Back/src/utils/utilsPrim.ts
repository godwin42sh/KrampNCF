import { differenceInMinutes, format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { LineData } from '../types/LineData';
import { PrimData } from '../types/PrimData';
import { MonitoredStopVisit, StopMonitoringDelivery } from '../types/PrimSNCF';
import { TrainResponse } from '../types/Response';
import { Departure } from '../types/Departure';

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

    if (visit.MonitoredVehicleJourney.MonitoredCall.DepartureStatus !== ''
    && visit.MonitoredVehicleJourney.MonitoredCall.DepartureStatus !== 'onTime'
    && visit.MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime
    && visit.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime) {
      tmp.delay = differenceInMinutes(
        visit.MonitoredVehicleJourney.MonitoredCall.AimedDepartureTime,
        visit.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime,
      );
    }

    res.push(tmp as TrainResponse);
  });

  return res;
}

export function getDeparturesFromPrim(
  primData: PrimData,
  primFetchedData: StopMonitoringDelivery[],
  trainNumbersFilter: string[] = [],
) {
  let res: TrainResponse[] = [];

  primFetchedData.forEach((departure) => {
    res = [
      ...res,
      ...buildDepartureFromStops(
        primData,
        departure.MonitoredStopVisit,
        trainNumbersFilter,
      ),
    ];
  });

  return res;
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

  if (delay <= 4) {
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
    // raw: departure,
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
