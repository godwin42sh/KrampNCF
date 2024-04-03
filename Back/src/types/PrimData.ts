export interface PrimData {
  id: number;
  departureName: string;
  destinationName: string;
  primDepartureRef: string;
  primLineRef: string;
  primJourneyNote?: string[];
  primDestinationRef?: string;
  trainNumberRefPrefix?: string;
  type: string;
}
