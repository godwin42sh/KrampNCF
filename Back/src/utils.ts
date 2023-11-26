import { format, parseISO } from 'date-fns';

import { SNCF } from './sncf-api';

import type { LineData } from './types/LineData';

export async function getDateFromQuery(query: string | undefined) {
  const dateFrom = query
    ? new Date(query)
    : new Date(new Date().toDateString());

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
    departureTime: format(parseISO(departure.stop_date_time.departure_date_time), 'HH:mm'),
    arrivaleTime: format(parseISO(departure.stop_date_time.arrival_date_time), 'HH:mm'),
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
