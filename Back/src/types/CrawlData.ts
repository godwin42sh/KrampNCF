import type { TrainType } from "./CrawlFlareDeparture";

export interface CrawlData {
  id: number;
  title: string;
  flareId: string;
  destinationName: string;
  stopToMatch: string[];
  /** Train types that match a watched destination but skip the stop. */
  excludeTrainTypes?: TrainType[];
}
