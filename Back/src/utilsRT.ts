import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type GtfsRealtimeBindings from 'gtfs-realtime-bindings';

import type { Departure } from './types/Departure';
import type { LineData } from './types/LineData';
import type { TrainResponse } from './types/Response';
import type { TrainTimeEvent } from './types/ResponseRT';

import { readGtfsRT } from './gtfs-api';

function buildDateObject(
  stopTimeEvent: GtfsRealtimeBindings.transit_realtime.TripUpdate.IStopTimeEvent,
) {
  let eventObject: TrainTimeEvent = {
    time: formatInTimeZone(new Date(stopTimeEvent.time as number * 1000), 'Europe/Paris', 'HH:mm'),
  };

  if (stopTimeEvent.delay) {
    eventObject = {
      ...eventObject,
      delay: stopTimeEvent.delay / 60,
      scheduledTime:
      formatInTimeZone(
        new Date(
          (stopTimeEvent.time as number) * 1000 - (stopTimeEvent.delay * 1000),
        ),
        'Europe/Paris',
        'HH:mm',
      ),
    };
  }

  return eventObject;
}

function calcDatesFromStopTimeUpdate(
  stopTimeUpdate: GtfsRealtimeBindings.transit_realtime.TripUpdate.IStopTimeUpdate,
) {
  const arrivalObject = stopTimeUpdate.arrival
    ? { arrival: buildDateObject(stopTimeUpdate.arrival) } : {};
  const departureObject = stopTimeUpdate.departure
    ? { departure: buildDateObject(stopTimeUpdate.departure) } : {};

  return {
    ...arrivalObject,
    ...departureObject,
  };
}

export async function getDeparturesFromToRealtime(
  lineFrom: LineData,
  lineTo: LineData,
  feedInit?: [GtfsRealtimeBindings.transit_realtime.FeedMessage, boolean],
) {
  const [feed, isCached] = feedInit || await readGtfsRT();

  const res: any[] = [];

  feed.entity.forEach((entity) => {
    if (entity.tripUpdate) {
      let fromStopTimeUpdate:
      GtfsRealtimeBindings.transit_realtime.TripUpdate.IStopTimeUpdate
      | undefined;

      entity.tripUpdate.stopTimeUpdate?.forEach((stopTimeUpdate) => {
        if (!fromStopTimeUpdate && stopTimeUpdate.stopId?.includes(lineFrom.gtfsId)) {
          fromStopTimeUpdate = stopTimeUpdate;
        } else if (fromStopTimeUpdate && stopTimeUpdate.stopId?.includes(lineTo.gtfsId)) {
          res.push(
            {
              ...{ title: lineTo.title, raw: entity },
              ...calcDatesFromStopTimeUpdate(fromStopTimeUpdate),
            },
          );
        }
      });
    }
  });

  return {
    title: `${lineFrom.title} - ${format(new Date(), 'dd/MM')}`,
    data: res,
    isCached,
  };
}

export async function getDeparturesFromLineDataRealtime(
  lineData: LineData,
  feedInit?: [GtfsRealtimeBindings.transit_realtime.FeedMessage, boolean],
) {
  const [feed, isCached] = feedInit || await readGtfsRT();

  const res: any[] = [];

  feed.entity.forEach((entity) => {
    if (entity.tripUpdate) {
      entity.tripUpdate.stopTimeUpdate?.forEach((stopTimeUpdate) => {
        if (stopTimeUpdate.stopId?.includes(lineData.gtfsId)) {
          res.push(
            {
              ...{ title: lineData.title },
              ...calcDatesFromStopTimeUpdate(stopTimeUpdate),
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
  tripsDelayed: GtfsRealtimeBindings.transit_realtime.TripUpdate.IStopTimeUpdate[],
  departure: Departure,
) {
  const arrivalDate = parseISO(departure.stop_date_time.arrival_date_time);
  const departureDate = parseISO(departure.stop_date_time.departure_date_time);

  const res: TrainResponse = {
    title: departure.display_informations.headsign,
    arrivalTime: format(arrivalDate, 'HH:mm'),
    departureTime: format(departureDate, 'HH:mm'),
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
