import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type GtfsRealtimeBindings from 'gtfs-realtime-bindings';

import type { Departure } from '../types/Departure';
import type { LineData } from '../types/LineData';
import type { DeparturesResponse, TrainResponse } from '../types/Response';
import type { TrainTimeEvent } from '../types/ResponseRT';

import { readGtfsRT } from '../services/gtfs-api';

function formatStopTimeEvent(
  departureStopTimeEvent: GtfsRealtimeBindings.transit_realtime.TripUpdate.IStopTimeEvent,
  arrivalStopTimeEvent?: GtfsRealtimeBindings.transit_realtime.TripUpdate.IStopTimeEvent | null,
): Omit<TrainResponse, 'title'> {
  return {
    arrivalTime: arrivalStopTimeEvent ? formatInTimeZone(new Date(arrivalStopTimeEvent.time as number * 1000), 'Europe/Paris', 'HH:mm') : undefined,
    departureTime: formatInTimeZone(new Date(departureStopTimeEvent.time as number * 1000), 'Europe/Paris', 'HH:mm'),
    delay: departureStopTimeEvent.delay ? departureStopTimeEvent.delay / 60 : undefined,
  };
}

export async function getDeparturesFromToRealtime(
  lineFrom: LineData,
  lineTo: LineData,
  feedInit?: [GtfsRealtimeBindings.transit_realtime.FeedMessage, boolean],
): Promise<DeparturesResponse> {
  const [feed, isCached] = feedInit || await readGtfsRT();

  const res: DeparturesResponse = {
    title: `${lineFrom.title} - ${lineTo.title} - ${format(new Date(), 'dd/MM')}`,
    data: [],
    isCached,
    fetchType: 'gtfs',
  };

  if (!feed.entity) {
    return res;
  }

  feed.entity.forEach((entity) => {
    if (entity.tripUpdate) {
      let fromStopTimeUpdate:
        GtfsRealtimeBindings.transit_realtime.TripUpdate.IStopTimeUpdate
        | undefined;

      entity.tripUpdate.stopTimeUpdate?.forEach((stopTimeUpdate) => {
        if (!fromStopTimeUpdate && stopTimeUpdate.stopId?.includes(lineFrom.gtfsId)) {
          fromStopTimeUpdate = stopTimeUpdate;
        } else if (fromStopTimeUpdate && stopTimeUpdate.stopId?.includes(lineTo.gtfsId) && fromStopTimeUpdate.departure) {
          res.data.push(
            {
              title: lineTo.title,
              ...formatStopTimeEvent(fromStopTimeUpdate.departure, fromStopTimeUpdate.arrival),
            },
          );
        }
      });
    }
  });

  return res;
}

export async function getDeparturesFromLineDataRealtime(
  lineData: LineData,
  feedInit?: [GtfsRealtimeBindings.transit_realtime.FeedMessage, boolean],
): Promise<DeparturesResponse> {
  const [feed, isCached] = feedInit || await readGtfsRT();

  const res: any[] = [];

  feed.entity.forEach((entity) => {
    if (entity.tripUpdate) {
      entity.tripUpdate.stopTimeUpdate?.forEach((stopTimeUpdate) => {
        if (stopTimeUpdate.stopId?.includes(lineData.gtfsId) && stopTimeUpdate.departure) {
          res.push(
            {
              title: lineData.title,
              ...formatStopTimeEvent(stopTimeUpdate.departure, stopTimeUpdate.arrival),
            },
          );
        }
      });
    }
  });

  return {
    title: `${lineData.title} - ${format(new Date(), 'dd/MM')}`,
    data: res,
    isCached,
    fetchType: 'gtfs',
  };
}

export function getDeparturesTimesWithDelayFromFeed(
  feed: GtfsRealtimeBindings.transit_realtime.FeedMessage,
  stationToFind: string,
) {
  const tripsDelayed: GtfsRealtimeBindings.transit_realtime.TripUpdate.IStopTimeUpdate[] = [];

  feed.entity.forEach((entity) => {
    if (entity.tripUpdate) {
      entity.tripUpdate.stopTimeUpdate?.forEach((stopTimeUpdate) => {
        if (stopTimeUpdate.stopId?.includes(stationToFind)) {
          if (stopTimeUpdate.departure?.delay) {
            tripsDelayed.push(stopTimeUpdate);
          }
        }
      });
    }
  });

  return tripsDelayed;
}

export function getDeparturesTimeWithDelayFromTimeUpdates(
  lineData: LineData,
  tripsDelayed: GtfsRealtimeBindings.transit_realtime.TripUpdate.IStopTimeUpdate[],
  departure: Departure,
) {
  const arrivalDate = parseISO(departure.stop_date_time.arrival_date_time);
  const departureDate = parseISO(departure.stop_date_time.departure_date_time);

  const res: TrainResponse = {
    title: lineData.destinationName,
    arrivalTime: format(arrivalDate, 'HH:mm'),
    departureTime: format(departureDate, 'HH:mm'),
    trainNumber: departure.display_informations.trip_short_name,
    // raw: departure,
  };

  tripsDelayed.forEach((timeUpdate) => {
    const scheduledTime = new Date(
      (timeUpdate.departure?.time as number) * 1000
      - (timeUpdate.departure?.delay as number * 1000),
    );

    scheduledTime.setSeconds(0);
    departureDate.setSeconds(0);

    if (scheduledTime.getTime() === departureDate.getTime()) {
      if (timeUpdate.arrival?.delay) {
        res.arrivalTime = formatInTimeZone(new Date(timeUpdate.arrival.time as number * 1000), 'Europe/Paris', 'HH:mm');
      }
      if (timeUpdate.departure?.delay) {
        res.departureTime = formatInTimeZone(new Date(timeUpdate.departure.time as number * 1000), 'Europe/Paris', 'HH:mm');
      }
      res.delay = timeUpdate.departure?.delay as number / 60;
    }
  });

  return res;
}
