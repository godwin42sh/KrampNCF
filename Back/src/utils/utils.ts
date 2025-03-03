import { format, parseISO } from 'date-fns';

import crawlsData from '../conf/crawl-data';
import { Departure } from '../types/Departure';
import { CrawlFlare } from '../services/crawl-flare-api';
import type { RTFetchType } from '../types/RTFetchType';
import type { DeparturesResponse, TrainResponse } from '../types/Response';
import type { LineData } from '../types/LineData';

import { Crawl } from '../services/crawl-api';
import { Prim } from '../services/prim-api';

import { SNCF } from '../services/sncf-api';
import { readGtfsRT } from '../services/gtfs-api';
import { getDeparturesTimesWithDelayFromFeed, getDeparturesTimeWithDelayFromTimeUpdates } from './utilsRT';
import primsData from '../conf/prim-data';
import { getDeparturesFromScheduledAndPrim } from './utilsPrim';
import { mergeCrawlFlareWithScheduledData } from './utilsFlare';

export function subtractHours(date: Date, hours: number) {
  date.setHours(date.getHours() - hours);
  return date;
}

export function getDateFromQuery(query: string | undefined): Date | false {
  const dateFrom = query
    ? new Date(query)
    : subtractHours(new Date(), 1);

  if (Number.isNaN(dateFrom.getTime())) {
    return false;
  }

  return dateFrom;
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

export async function fetchDataFromLineDataGTFS(sncf: SNCF, lineData: LineData, dateFrom: Date) {
  const departures = await sncf.getDepartures(lineData.stopAreaId, dateFrom, lineData.stopFilters);

  const res = {
    title: `${lineData.title} - ${format(dateFrom, 'dd/MM')}`,
    data: [],
    isCached: departures.isCached,
    fetchType: 'gtfs' as RTFetchType,
  };

  const dateFromStr = format(dateFrom, 'yyyyMMdd');

  departures.data = departures.data.filter(
    (departure) => departure.route.direction.id === lineData.directionAreaId
      && departure.stop_date_time.departure_date_time.startsWith(dateFromStr),
  );

  if (!departures.data.length) {
    return res;
  }

  const feedRaw = await readGtfsRT();

  if (!feedRaw) {
    return res;
  }

  const [feed] = feedRaw;

  const tripsDelayed = getDeparturesTimesWithDelayFromFeed(feed, lineData.gtfsId);

  const resTimes = departures.data.map(
    (departure) => getDeparturesTimeWithDelayFromTimeUpdates(lineData, tripsDelayed, departure),
  );

  return {
    ...res,
    data: await addDockToTrainResponse(lineData, resTimes),
  };
}

export async function fetchDataFromLineDataPrim(
  sncf: SNCF,
  lineData: LineData,
  dateFrom: Date,
): Promise<DeparturesResponse> {
  const departures = await sncf.getDepartures(lineData.stopAreaId, dateFrom, lineData.stopFilters);

  const res = {
    title: `${lineData.title} - ${format(dateFrom, 'dd/MM')}`,
    data: [],
    isCached: departures.isCached,
    fetchType: 'prim' as RTFetchType,
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

export function parseScheduledData(lineData: LineData, departures: Departure[]): TrainResponse[] {
  return departures.map((departure) => {
    const arrivalDate = parseISO(departure.stop_date_time.arrival_date_time);
    const departureDate = parseISO(departure.stop_date_time.departure_date_time);

    return {
      title: lineData.destinationName,
      arrivalTime: format(arrivalDate, 'HH:mm'),
      departureTime: format(departureDate, 'HH:mm'),
      trainNumber: departure.display_informations.trip_short_name,
    };
  });
}

export async function fetchDataFromLineDataCrawlFlare(
  sncf: SNCF,
  lineData: LineData,
  dateFrom: Date,
): Promise<DeparturesResponse> {
  const departures = await sncf.getDepartures(lineData.stopAreaId, dateFrom, lineData.stopFilters);

  const res = {
    title: `${lineData.title} - ${format(dateFrom, 'dd/MM')}`,
    data: [],
    isCached: departures.isCached,
    fetchType: 'crawlFlare' as RTFetchType,
  };

  const dateFromStr = format(dateFrom, 'yyyyMMdd');

  departures.data = departures.data.filter(
    (departure) => departure.route.direction.id === lineData.directionAreaId
      && departure.stop_date_time.departure_date_time.startsWith(dateFromStr),
  );

  if (!departures.data.length) {
    return res;
  }

  const crawlData = crawlsData.find((crawl) => crawl.id === lineData.crawlDataId);

  if (!crawlData) {
    return res;
  }

  const crawlFlare = new CrawlFlare(
    process.env.FLARE_API_URL as string,
    process.env.SNCF_CRAWL_FLARE_URL as string,
  );

  const departuresCrawl = await crawlFlare.getDepartures(crawlData);

  const resTimesScheduled = parseScheduledData(lineData, departures.data);

  const resTimes = mergeCrawlFlareWithScheduledData(
    resTimesScheduled,
    departuresCrawl.data,
    crawlData,
  );

  return {
    ...res,
    data: resTimes,
  };
}

type FunctionByType = {
  [key in RTFetchType]:
  (sncf: SNCF, lineData: LineData, dateFrom: Date) => Promise<DeparturesResponse>;
};

export async function fetchDataFromLineData(
  sncf: SNCF,
  lineData: LineData,
  dateFrom: Date,
  type: RTFetchType,
): Promise<DeparturesResponse> {
  const funcByType: FunctionByType = {
    gtfs: fetchDataFromLineDataGTFS,
    prim: fetchDataFromLineDataPrim,
    crawlFlare: fetchDataFromLineDataCrawlFlare,
  };
  return funcByType[type](sncf, lineData, dateFrom);
}

export async function fetchDataFromLinesData(
  sncf: SNCF,
  lineDatas: LineData[],
  dateFrom: Date,
  type: RTFetchType,
) {
  const resTimes = await Promise.allSettled(
    lineDatas.map((lineData) => fetchDataFromLineData(sncf, lineData, dateFrom, type)),
  );

  return resTimes.reduce((acc: DeparturesResponse[], res) => {
    if (res.status === 'fulfilled') {
      acc.push(res.value);
    }

    return acc;
  }, []);
}

export function isRTFetchType(type?: string): type is RTFetchType {
  return !!type && ['gtfs', 'prim', 'crawlFlare'].includes(type);
}

export function getDefaultFetchRTMethod(): RTFetchType {
  const defaultMethod = process.env.DEFAULT_FETCH_RT_METHOD;

  return isRTFetchType(defaultMethod) ? defaultMethod : 'crawlFlare';
}
