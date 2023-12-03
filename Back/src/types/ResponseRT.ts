export type TrainTimeEvent = {
  time: string;
  delay?: number;
  scheduledTime?: string;
};

export type TrainResponseRT = {
  title: string;
  departure: Event;
};
