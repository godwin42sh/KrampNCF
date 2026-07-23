import { differenceInMinutes } from "date-fns";

import type { DeparturesResponse, TrainResponse } from "../types/Response";

export type AwtrixResponse = {
  icon: string;
  color: string;
  pos: number;
  text: string;
};

export type AwtrixIcons = {
  iconTer: string;
  iconRer: string;
};

const MINUTES_IN_DAY = 24 * 60;

/**
 * Minutes from now until an HH:mm departure time.
 * Times that appear far in the past are assumed to be right after
 * midnight the next day (§2.4 of the optimization report).
 */
function minutesUntilDeparture(departureTime: string, now: Date): number {
  const [hours, minutes] = departureTime.split(":").map(Number);
  const departureDate = new Date(now);
  departureDate.setHours(hours, minutes, 0, 0);

  let minDiff = differenceInMinutes(departureDate, now);

  if (minDiff < -MINUTES_IN_DAY / 2) {
    minDiff += MINUTES_IN_DAY;
  }

  return minDiff;
}

export default function formatDeparturesAwtrix(
  departuresResponse: DeparturesResponse,
  icons: AwtrixIcons,
): AwtrixResponse {
  const dateNow = new Date();

  if (!departuresResponse.data?.length) {
    return {
      icon: icons.iconTer,
      color: "#FF0000",
      pos: 1,
      text: "No trains",
    };
  }

  const departuresNextHour = departuresResponse.data.filter((departure) => {
    if (departure.deleted === true) {
      return false;
    }

    const minDiff = minutesUntilDeparture(departure.departureTime, dateNow);
    return minDiff > 20 && minDiff < 80;
  });

  let nextTrain: TrainResponse | undefined;

  if (departuresNextHour.length === 0) {
    [nextTrain] = departuresResponse.data;
  } else {
    nextTrain =
      departuresNextHour.find((departure) => departure.trainType === "TER") ??
      departuresNextHour[0];
  }

  return {
    icon: nextTrain.trainType === "TER" ? icons.iconTer : icons.iconRer,
    color: nextTrain.delay ? "#FF0000" : "#FFFFFF",
    pos: 1,
    text: nextTrain.departureTime,
  };
}
