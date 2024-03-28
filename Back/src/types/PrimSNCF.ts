export interface PrimSNCF {
  Siri: Siri;
}

export interface Siri {
  ServiceDelivery: ServiceDelivery;
}

export interface ServiceDelivery {
  ResponseTimestamp: Date;
  ProducerRef: string;
  ResponseMessageIdentifier: string;
  StopMonitoringDelivery: StopMonitoringDelivery[];
}

export interface StopMonitoringDelivery {
  ResponseTimestamp: Date;
  Version: string;
  Status: string;
  MonitoredStopVisit: MonitoredStopVisit[];
}

export interface MonitoredStopVisit {
  RecordedAtTime: Date;
  ItemIdentifier: string;
  MonitoringRef: MonitoringRef;
  MonitoredVehicleJourney: MonitoredVehicleJourney;
}

export interface MonitoredVehicleJourney {
  LineRef: MonitoringRef;
  OperatorRef: MonitoringRef;
  FramedVehicleJourneyRef: FramedVehicleJourneyRef;
  DirectionName: any[];
  DestinationRef: MonitoringRef;
  DestinationName: MonitoringRef[];
  VehicleJourneyName: any[];
  JourneyNote: any[];
  MonitoredCall: MonitoredCall;
  TrainNumbers: TrainNumbers;
}

export interface MonitoringRef {
  value: string;
}

export interface FramedVehicleJourneyRef {
  DataFrameRef: MonitoringRef;
  DatedVehicleJourneyRef: string;
}

export interface MonitoredCall {
  StopPointName: MonitoringRef[];
  VehicleAtStop: boolean;
  DestinationDisplay: MonitoringRef[];
  ExpectedArrivalTime?: Date;
  ExpectedDepartureTime?: Date;
  DepartureStatus: string;
  Order: number;
  AimedArrivalTime?: Date;
  ArrivalPlatformName?: MonitoringRef;
  ArrivalStatus: string;
  AimedDepartureTime?: Date;
}

export interface TrainNumbers {
  TrainNumberRef: MonitoringRef[];
}
