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

export async function fetchDataFromLineData(lineData: LineData, dateFrom: Date) {
  const sncf = new SNCF(process.env.SNCF_API_URL as string, process.env.SNCF_API_KEY as string);
  const departures = await sncf.getDepartures(lineData.stopAreaId, dateFrom, lineData.stopFilters);

  departures.data = departures.data.filter(
    (departure) => departure.route.direction.id === lineData.directionAreaId,
  );

  const resTimes = departures.data.map((departure) => ({
    title: departure.display_informations.headsign,
    departureTime: format(parseISO(departure.stop_date_time.departure_date_time), 'dd/MM/yyyy HH:mm:ss'),
    arrivaleTime: format(parseISO(departure.stop_date_time.arrival_date_time), 'dd/MM/yyyy HH:mm:ss'),
    // raw: departure,
  }));

  return {
    title: lineData.title,
    data: resTimes,
    isCached: departures.isCached,
  };
}

export async function fetchDataFromLinesData(lineDatas: LineData[], dateFrom: Date) {
  const promises = lineDatas.map((lineData) => fetchDataFromLineData(lineData, dateFrom));

  const resTimes = await Promise.all(promises);

  return resTimes;
}
