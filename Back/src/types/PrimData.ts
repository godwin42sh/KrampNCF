export interface PrimData {
  id: number;
  departureName: string;
  destinationName: string;
  primDepartureRef: string;
  primDestinationRef?: string;
  primLineRef: string;
  trainNumberRefPrefix?: string;
}
