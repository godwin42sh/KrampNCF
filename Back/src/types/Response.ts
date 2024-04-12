import type { RTFetchType } from './RTFetchType';

export type TrainResponse = {
  title: string;
  arrivalTime?: string;
  departureTime: string;
  delay?: number;
  raw?: any;
  trainNumber?: string;
  trainType?: string;
  dock?: string;
};

export type DeparturesResponse = {
  title: string;
  data: TrainResponse[];
  fetchType: RTFetchType;
  isCached: boolean;
};
