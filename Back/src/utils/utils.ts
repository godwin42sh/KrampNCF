import { format } from 'date-fns';

import { Crawl } from '../services/crawl-api';
import { TrainResponse } from '../types/Response';
import { Prim } from '../services/prim-api';
import type { LineData } from '../types/LineData';

import { SNCF } from '../services/sncf-api';
import { readGtfsRT } from '../services/gtfs-api';
import { getDeparturesTimesWithDelayFromFeed, getDeparturesTimeWithDelayFromTimeUpdates } from './utilsRT';
import primsData from '../conf/prim-data';
import { getDeparturesFromScheduledAndPrim } from './utilsPrim';

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

  const res = {
    title: `${lineData.title} - ${format(dateFrom, 'dd/MM')}`,
    data: [],
    isCached: departures.isCached,
  };

  const dateFromStr = format(dateFrom, 'yyyyMMdd');

  departures.data = departures.data.filter(
    (departure) => departure.route.direction.id === lineData.directionAreaId
      && departure.stop_date_time.departure_date_time.startsWith(dateFromStr),
  );

  if (!departures.data.length) {
    return res;
  }

  const [feed] = await readGtfsRT();

  const tripsDelayed = getDeparturesTimesWithDelayFromFeed(feed, lineData.gtfsId);

  const resTimes = departures.data.map(
    (departure) => getDeparturesTimeWithDelayFromTimeUpdates(lineData, tripsDelayed, departure),
  );

  return {
    ...res,
    data: resTimes,
  };
}

export async function addDockToTrainResponse(lineData: LineData, trainResponses: TrainResponse[]) {
  const crawl = new Crawl(process.env.SNCF_CRAWL_URL as string);
  const crawlRes = await crawl.getDepartures(lineData);

  return trainResponses.map((train) => {
    const crawlMatching = crawlRes.data.find((cres) => cres.trainNumber === train.trainNumber);

    if (!crawlMatching?.dock) return train;

    return {
      ...train,
      dock: crawlMatching.dock,
    };
  });
}

export async function fetchDataFromLineDataPrim(sncf: SNCF, lineData: LineData, dateFrom: Date) {
  const departures = await sncf.getDepartures(lineData.stopAreaId, dateFrom, lineData.stopFilters);

  const res = {
    title: `${lineData.title} - ${format(dateFrom, 'dd/MM')}`,
    data: [],
    isCached: departures.isCached,
  };

  const dateFromStr = format(dateFrom, 'yyyyMMdd');

  departures.data = departures.data.filter(
    (departure) => departure.route.direction.id === lineData.directionAreaId
      && departure.stop_date_time.departure_date_time.startsWith(dateFromStr),
  );

  if (!departures.data.length) {
    return res;
  }

  const prim = new Prim(
    process.env.SNCF_API_PRIM_URL as string,
    process.env.SNCF_API_PRIM_KEY as string,
  );

  const primData = primsData.find((data) => data.id === lineData.primDataId);

  if (!primData) {
    return res;
  }

  const departuresPrim = await prim.getDepartures(primData);
  const departuresPrimFlatten = departuresPrim.data.flatMap((data) => data.MonitoredStopVisit);

  const resTimes = departures.data.map(
    (departure) => getDeparturesFromScheduledAndPrim(lineData, departure, departuresPrimFlatten),
  );

  return {
    ...res,
    data: await addDockToTrainResponse(lineData, resTimes),
  };
}

export async function fetchDataFromLinesData(sncf: SNCF, lineDatas: LineData[], dateFrom: Date, type: 'prim' | 'gtfs' = 'gtfs') {
  const functionToUse = type === 'prim' ? fetchDataFromLineDataPrim : fetchDataFromLineData;
  const promises = lineDatas.map((lineData) => functionToUse(sncf, lineData, dateFrom));

  const resTimes = await Promise.all(promises);

  return resTimes;
}
