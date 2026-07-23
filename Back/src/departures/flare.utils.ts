import { format, parseISO } from "date-fns";

import type { CrawlData } from "../types/CrawlData";
import type {
  CrawlFlareDeparture,
  TrainType,
} from "../types/CrawlFlareDeparture";
import type { IsCached } from "../types/IsCached";
import type { DeparturesResponse, TrainResponse } from "../types/Response";

function parseCrawlFlareDeparture(
  title: string,
  departure: CrawlFlareDeparture,
): TrainResponse {
  const departureTime = parseISO(departure.actualTime);
  const delay =
    departure.informationStatus.trainStatus === "RETARD" &&
    departure.informationStatus.delay
      ? departure.informationStatus.delay
      : undefined;

  return {
    title,
    departureTime: format(departureTime, "HH:mm"),
    delay,
    dock: departure.platform.track || undefined,
    trainNumber: departure.missionCode || departure.trainNumber,
    trainType: departure.trainType,
    deleted: departure.informationStatus.trainStatus === "SUPPRESSION_TOTALE",
  };
}

export function parseCrawlFlareDepartures(
  crawlData: CrawlData,
  departuresRaw: IsCached<CrawlFlareDeparture[]>,
  trainTypeFilter?: TrainType,
): TrainResponse[] {
  const departures: TrainResponse[] = [];

  departuresRaw.data.forEach((departure) => {
    if (trainTypeFilter && departure.trainType !== trainTypeFilter) {
      return;
    }

    if (crawlData.stopToMatch.includes(departure.traffic.destination)) {
      departures.push(
        parseCrawlFlareDeparture(crawlData.destinationName, departure),
      );
    }
  });

  return departures;
}

export function parseCrawlFlareDeparturesWithTitle(
  crawlData: CrawlData,
  departuresRaw: IsCached<CrawlFlareDeparture[]>,
  trainTypeFilter?: TrainType,
): DeparturesResponse {
  const title = trainTypeFilter
    ? `${crawlData.title} - ${trainTypeFilter}`
    : `${crawlData.title} - ${format(new Date(), "dd/MM")}`;

  return {
    title,
    data: parseCrawlFlareDepartures(crawlData, departuresRaw, trainTypeFilter),
    fetchType: "crawlFlare",
    isCached: departuresRaw.isCached,
  };
}

export function mergeCrawlFlareWithScheduledData(
  scheduledData: TrainResponse[],
  crawlRaw: CrawlFlareDeparture[],
  crawlData: CrawlData,
  trainTypeFilter?: TrainType,
): TrainResponse[] {
  const crawlDataFiltered = trainTypeFilter
    ? crawlRaw.filter((crawl) => crawl.trainType === trainTypeFilter)
    : crawlRaw;

  return scheduledData.map((scheduled) => {
    const crawlDeparture = crawlDataFiltered.find(
      (crawlDep) => crawlDep.trainNumber === scheduled.trainNumber,
    );

    if (!crawlDeparture) {
      return scheduled;
    }

    const stopFound = crawlDeparture.stops.find((stop) =>
      crawlData.stopToMatch.includes(stop),
    );

    if (!stopFound) {
      return scheduled;
    }

    return {
      ...scheduled,
      ...parseCrawlFlareDeparture(scheduled.title, crawlDeparture),
    };
  });
}
