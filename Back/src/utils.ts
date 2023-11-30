import { format, parseISO } from 'date-fns';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

import { SNCF } from './sncf-api';
import { readGtfsRT } from './gtfs-api';
import type { LineData } from './types/LineData';
import type { Event } from './types/ResponseRT';

export function subtractHours(date: Date, hours: number) {
  date.setHours(date.getHours() - hours);
  return date;
}

export async function getDateFromQuery(query: string | undefined) {
  const dateFrom = query
    ? new Date(query)
    : subtractHours(new Date(), 1);

  if (Number.isNaN(dateFrom.getTime())) {
    return false;
  }

  return dateFrom;
}

export async function fetchDataFromLineData(sncf: SNCF, lineData: LineData, dateFrom: Date) {
  const departures = await sncf.getDepartures(lineData.stopAreaId, dateFrom, lineData.stopFilters);

  const dateFromStr = format(dateFrom, 'yyyyMMdd');

  departures.data = departures.data.filter(
    (departure) => departure.route.direction.id === lineData.directionAreaId
      && departure.stop_date_time.departure_date_time.startsWith(dateFromStr),
  );

  const resTimes = departures.data.map((departure) => ({
    title: departure.display_informations.headsign,
    arrivalTime: format(parseISO(departure.stop_date_time.arrival_date_time), 'HH:mm'),
    departureTime: format(parseISO(departure.stop_date_time.departure_date_time), 'HH:mm'),
    // raw: departure,
  }));

  return {
    title: `${lineData.title} - ${format(dateFrom, 'dd/MM')}`,
    data: resTimes,
    isCached: departures.isCached,
  };
}

export async function fetchDataFromLinesData(sncf: SNCF, lineDatas: LineData[], dateFrom: Date) {
  const promises = lineDatas.map((lineData) => fetchDataFromLineData(sncf, lineData, dateFrom));

  const resTimes = await Promise.all(promises);

  return resTimes;
}

export function buildDateObject(
  stopTimeEvent: GtfsRealtimeBindings.transit_realtime.TripUpdate.IStopTimeEvent,
) {
  let eventObject: Event = {
    time: format(new Date(stopTimeEvent.time as number * 1000), 'HH:mm'),
  };

  if (stopTimeEvent.delay) {
    eventObject = {
      ...eventObject,
      delay: stopTimeEvent.delay / 60,
      realTime:
        format(
          new Date(
            (stopTimeEvent.time as number) * 1000 + (stopTimeEvent.delay * 1000),
          ),
          'HH:mm',
        ),
    };
  }

  return eventObject;
}

export function calcDatesFromStopTimeUpdate(
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
              ...{ title: lineTo.title },
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
