export type Event = {
  time: string;
  delay?: number;
  realTime?: string;
};

export type ResponseRT = {
  title: string;
  departure: Event;
};
