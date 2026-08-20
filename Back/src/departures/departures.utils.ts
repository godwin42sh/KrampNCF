import { format, parseISO } from "date-fns";

import type { CrawlRes } from "../types/CrawlRes";
import type { Departure } from "../types/Departure";
import type { LineData } from "../types/LineData";
import type { TrainResponse } from "../types/Response";

/** Non-mutating (§2.3 of the optimization report). */
export function subtractHours(date: Date, hours: number): Date {
  return new Date(date.getTime() - hours * 3_600_000);
}

export function getDateFromQuery(query: string | undefined): Date | false {
  const dateFrom = query ? new Date(query) : subtractHours(new Date(), 1);

  if (Number.isNaN(dateFrom.getTime())) {
    return false;
  }

  return dateFrom;
}

/**
 * Common prelude shared by the gtfs/prim/crawlFlare merge flows (§4.1):
 * keep only departures in the requested direction on the requested day.
 */
export function filterScheduledDepartures(
  lineData: LineData,
  dateFrom: Date,
  departures: Departure[],
): Departure[] {
  const dateFromStr = format(dateFrom, "yyyyMMdd");

  return departures.filter(
    (departure) =>
      departure.route.direction.id === lineData.directionAreaId &&
      departure.stop_date_time.departure_date_time.startsWith(dateFromStr),
  );
}

export function parseScheduledData(
  lineData: LineData,
  departures: Departure[],
): TrainResponse[] {
  return departures.map((departure) => {
    const arrivalDate = parseISO(departure.stop_date_time.arrival_date_time);
    const departureDate = parseISO(
      departure.stop_date_time.departure_date_time,
    );

    return {
      title: lineData.destinationName,
      arrivalTime: format(arrivalDate, "HH:mm"),
      departureTime: format(departureDate, "HH:mm"),
      trainNumber: departure.display_informations.trip_short_name,
    };
  });
}

/** Enrich train responses with the dock scraped from ter.sncf.com. */
export function addDockToTrainResponses(
  trains: TrainResponse[],
  crawlRes: CrawlRes[],
): TrainResponse[] {
  if (!crawlRes.length) {
    return trains;
  }

  return trains.map((train) => {
    const crawlMatching = crawlRes.find(
      (cres) => cres.trainNumber === train.trainNumber,
    );

    if (!crawlMatching?.dock) return train;

    return {
      ...train,
      dock: crawlMatching.dock,
    };
  });
}

function normalizeStation(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Case- and accent-insensitive station match for the ?from= query param:
 * "etampes" matches "Étampes", "austerlitz" matches "Gare d'Austerlitz".
 */
export function matchesStation(name: string, query: string): boolean {
  return normalizeStation(name).includes(normalizeStation(query));
}
