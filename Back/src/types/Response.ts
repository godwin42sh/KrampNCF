import type { RTFetchType } from './RTFetchType';

export type TrainResponse = {
  title: string;
  arrivalTime?: string;
  departureTime: string;
  delay?: number;
  deleted?: boolean;
  raw?: unknown;
  trainNumber?: string;
  trainType?: string;
  dock?: string;
};

export type DeparturesResponse = {
  title: string;
  data: TrainResponse[];
  /** RTFetchType covers the scheduled-merge flows; "siri" is board-only. */
  fetchType: RTFetchType | "siri";
  isCached: boolean;
};
