/** One stop call of a vehicle journey in the SIRI ET feed. */
export interface SiriCall {
  /** e.g. "FR:ScheduledStopPoint::87545137" — ends with the UIC code. */
  stopRef: string;
  stopName?: string;
  aimedArrivalTime?: string;
  expectedArrivalTime?: string;
  aimedDepartureTime?: string;
  expectedDepartureTime?: string;
  arrivalPlatform?: string;
  departurePlatform?: string;
}

/** A vehicle journey extracted from the national SIRI ET Lite feed. */
export interface SiriJourney {
  /** 6-digit SNCF train number (e.g. "860589"), when extractable. */
  trainNumber?: string;
  /** "C" for RER C journeys, otherwise a FR:Line:: reference. */
  lineRef?: string;
  originName?: string;
  destinationName?: string;
  cancelled: boolean;
  /** All calls (recorded + estimated), in journey order. */
  calls: SiriCall[];
}

/** A departure board built from the SIRI ET feed. */
export interface SiriBoard {
  id: number;
  departureName: string;
  destinationName: string;
  /** UIC codes of the departure stop (several for multi-part stations). */
  fromUics: string[];
  /** UIC codes the journey must call at afterwards (direction filter). */
  toUics: string[];
  type: string;
}
