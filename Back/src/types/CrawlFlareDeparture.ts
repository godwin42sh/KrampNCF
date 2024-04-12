export interface CrawlFlareDeparture {
  direction: Direction;
  trainNumber: string;
  scheduledTime: string;
  actualTime: string;
  trainType: TrainType;
  trainMode: TrainMode;
  informationStatus: InformationStatus;
  platform: Platform;
  traffic: Traffic;
  TrafficDetailsUrl: string;
  statusModification: null;
  uic: string;
  missionCode: MissionCode | null;
  trainLine: TrainLine;
  isGL: boolean;
  shortTermInformations: any[];
  presentation: Presentation;
  stops: string[];
  alternativeMeans: null;
  stationName: StationName;
}

export enum Direction {
  Departure = 'Departure',
}

export interface InformationStatus {
  trainStatus: TrainStatus;
  eventLevel: EventLevel;
  delay: null;
}

export enum EventLevel {
  Normal = 'Normal',
}

export enum TrainStatus {
  Ontime = 'Ontime',
  SuppressionTotale = 'SUPPRESSION_TOTALE',
}

export enum MissionCode {
  C = 'C',
  Elba = 'ELBA',
  Sara = 'SARA',
  Slom = 'SLOM',
}

export interface Platform {
  track: null | string;
  isTrackactive: boolean;
  trackGroupTitle: null;
  trackGroupValue: null;
  backgroundColor: null;
  trackPosition: TrackPosition | null;
}

export interface TrackPosition {
  track: string;
  latitude: number;
  longitude: number;
  level: number;
}

export interface Presentation {
  colorCode: ColorCode;
  textColorCode: TextColorCode;
}

export enum ColorCode {
  Ffcc30 = '#FFCC30',
  The1D1E27 = '#1d1e27',
}

export enum TextColorCode {
  Ffffff = '#FFFFFF',
}

export enum StationName {
  Étampes = 'Étampes',
  ParisAusterlitz = 'Paris Austerlitz',
  ParisAusterlitzRERC = 'Paris Austerlitz RER C',
}

export interface Traffic {
  origin: Destination;
  destination: Destination;
  oldOrigin: string;
  oldDestination: string;
  eventStatus: null | string;
  eventLevel: EventLevel;
}

export enum Destination {
  Orléans = 'Orléans',
  ParisAusterlitz = 'Paris Austerlitz',
  ParisAusterlitzRERC = 'Paris Austerlitz RER C',
  SaintMartinDÉtampes = "Saint-Martin d'Étampes",
  SaintQuentinEnYvelinesMontignyLEBretonneux = 'Saint-Quentin en Yvelines - Montigny-le-Bretonneux',
}

export enum TrainLine {
  C = 'C',
  Empty = '',
}

export enum TrainMode {
  Car = 'CAR',
  Train = 'TRAIN',
}

export enum TrainType {
  Intercités = 'Intercités',
  IntercitésDeNuit = 'Intercités de nuit',
  OUIGOTrainClassique = 'OUIGO Train Classique',
  Rer = 'RER',
  Ter = 'TER',
  Transilien = 'TRANSILIEN',
}
