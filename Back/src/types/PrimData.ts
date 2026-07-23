export interface PrimData {
  id: number;
  departureName: string;
  destinationName: string;
  /**
   * PRIM SIRI monitoring reference. For train departures this MUST be a
   * StopArea (zone de lieu) reference — `STIF:StopArea:SP:<ZdLId>:` — not a
   * StopPoint/quay; IDFM only serves train realtime at the StopArea level.
   */
  primDepartureRef: string;
  /**
   * Destination names (MonitoredVehicleJourney.DestinationName) to keep — the
   * direction filter. Needed because a terminus like Austerlitz lists every
   * outbound direction. Empty keeps all directions.
   */
  destinationMatch: string[];
  /** Optional line filter (STIF:Line::…). Omit to keep every line (RER C + TER). */
  primLineRefs?: string[];
  primJourneyNote?: string[];
  type: string;
}
