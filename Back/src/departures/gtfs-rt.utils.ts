import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type GtfsRealtimeBindings from "gtfs-realtime-bindings";

import type { FeedMessage } from "../gtfs/gtfs.service";
import type { Departure } from "../types/Departure";
import type { IsCached } from "../types/IsCached";
import type { LineData } from "../types/LineData";
import type { DeparturesResponse, TrainResponse } from "../types/Response";

type IStopTimeEvent =
  GtfsRealtimeBindings.transit_realtime.TripUpdate.IStopTimeEvent;
type IStopTimeUpdate =
  GtfsRealtimeBindings.transit_realtime.TripUpdate.IStopTimeUpdate;

function formatStopTimeEvent(
  departureStopTimeEvent: IStopTimeEvent,
  arrivalStopTimeEvent?: IStopTimeEvent | null,
): Omit<TrainResponse, "title"> {
  return {
    arrivalTime: arrivalStopTimeEvent
      ? formatInTimeZone(
          new Date((arrivalStopTimeEvent.time as number) * 1000),
          "Europe/Paris",
          "HH:mm",
        )
      : undefined,
    departureTime: formatInTimeZone(
      new Date((departureStopTimeEvent.time as number) * 1000),
      "Europe/Paris",
      "HH:mm",
    ),
    delay: departureStopTimeEvent.delay
      ? departureStopTimeEvent.delay / 60
      : undefined,
  };
}

export function getDeparturesFromToRealtime(
  lineFrom: LineData,
  lineTo: LineData,
  feedRes: IsCached<FeedMessage>,
): DeparturesResponse {
  const res: DeparturesResponse = {
    title: `${lineFrom.title} - ${lineTo.title} - ${format(new Date(), "dd/MM")}`,
    data: [],
    isCached: feedRes.isCached,
    fetchType: "gtfs",
  };

  feedRes.data.entity?.forEach((entity) => {
    if (!entity.tripUpdate) return;

    let fromStopTimeUpdate: IStopTimeUpdate | undefined;

    entity.tripUpdate.stopTimeUpdate?.forEach((stopTimeUpdate) => {
      if (
        !fromStopTimeUpdate &&
        stopTimeUpdate.stopId?.includes(lineFrom.gtfsId)
      ) {
        fromStopTimeUpdate = stopTimeUpdate;
      } else if (
        fromStopTimeUpdate &&
        stopTimeUpdate.stopId?.includes(lineTo.gtfsId) &&
        fromStopTimeUpdate.departure
      ) {
        res.data.push({
          title: lineTo.title,
          ...formatStopTimeEvent(
            fromStopTimeUpdate.departure,
            fromStopTimeUpdate.arrival,
          ),
        });
      }
    });
  });

  return res;
}

export function getDeparturesFromLineDataRealtime(
  lineData: LineData,
  feedRes: IsCached<FeedMessage>,
): DeparturesResponse {
  const data: TrainResponse[] = [];

  feedRes.data.entity?.forEach((entity) => {
    if (!entity.tripUpdate) return;

    entity.tripUpdate.stopTimeUpdate?.forEach((stopTimeUpdate) => {
      if (
        stopTimeUpdate.stopId?.includes(lineData.gtfsId) &&
        stopTimeUpdate.departure
      ) {
        data.push({
          title: lineData.title,
          ...formatStopTimeEvent(
            stopTimeUpdate.departure,
            stopTimeUpdate.arrival,
          ),
        });
      }
    });
  });

  return {
    title: `${lineData.title} - ${format(new Date(), "dd/MM")}`,
    data,
    isCached: feedRes.isCached,
    fetchType: "gtfs",
  };
}

export function getDeparturesTimesWithDelayFromFeed(
  feed: FeedMessage,
  stationToFind: string,
): IStopTimeUpdate[] {
  const tripsDelayed: IStopTimeUpdate[] = [];

  feed.entity?.forEach((entity) => {
    if (!entity.tripUpdate) return;

    entity.tripUpdate.stopTimeUpdate?.forEach((stopTimeUpdate) => {
      if (
        stopTimeUpdate.stopId?.includes(stationToFind) &&
        stopTimeUpdate.departure?.delay
      ) {
        tripsDelayed.push(stopTimeUpdate);
      }
    });
  });

  return tripsDelayed;
}

export function getDeparturesTimeWithDelayFromTimeUpdates(
  lineData: LineData,
  tripsDelayed: IStopTimeUpdate[],
  departure: Departure,
): TrainResponse {
  const arrivalDate = parseISO(departure.stop_date_time.arrival_date_time);
  const departureDate = parseISO(departure.stop_date_time.departure_date_time);

  const res: TrainResponse = {
    title: lineData.destinationName,
    arrivalTime: format(arrivalDate, "HH:mm"),
    departureTime: format(departureDate, "HH:mm"),
    trainNumber: departure.display_informations.trip_short_name,
  };

  tripsDelayed.forEach((timeUpdate) => {
    const scheduledTime = new Date(
      (timeUpdate.departure?.time as number) * 1000 -
        (timeUpdate.departure?.delay as number) * 1000,
    );

    scheduledTime.setSeconds(0);
    departureDate.setSeconds(0);

    if (scheduledTime.getTime() === departureDate.getTime()) {
      if (timeUpdate.arrival?.delay) {
        res.arrivalTime = formatInTimeZone(
          new Date((timeUpdate.arrival.time as number) * 1000),
          "Europe/Paris",
          "HH:mm",
        );
      }
      if (timeUpdate.departure?.delay) {
        res.departureTime = formatInTimeZone(
          new Date((timeUpdate.departure.time as number) * 1000),
          "Europe/Paris",
          "HH:mm",
        );
      }
      res.delay = (timeUpdate.departure?.delay as number) / 60;
    }
  });

  return res;
}
