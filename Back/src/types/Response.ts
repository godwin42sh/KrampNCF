export type TrainResponse = {
  title: string;
  arrivalTime: string;
  departureTime: string;
  delay?: number;
  raw?: any;
  trainNumber?: string;
  dock?: string;
};
