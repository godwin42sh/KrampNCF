/**
 * Minimal SIRI ET Lite fixture modelled on the real national feed: one RER C
 * journey Austerlitz→Étampes (platform + 2 min delay), one mainline Rémi
 * Étampes→Austerlitz, and one Orléans express that does NOT call at Étampes.
 */
export const SIRI_ET_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<Siri xmlns="http://www.siri.org.uk/siri" version="2.0"><ServiceDelivery>
<EstimatedTimetableDelivery version="2.0"><EstimatedJourneyVersionFrame>

<EstimatedVehicleJourney>
  <LineRef>C</LineRef>
  <FramedVehicleJourneyRef><DatedVehicleJourneyRef>FR:VehicleJourney::145435f2c9ed:LOC</DatedVehicleJourneyRef></FramedVehicleJourneyRef>
  <OriginName>Paris Austerlitz RER C</OriginName>
  <DestinationName>Saint-Martin d'Étampes</DestinationName>
  <EstimatedCalls>
    <EstimatedCall>
      <StopPointRef>FR:ScheduledStopPoint::87547026</StopPointRef>
      <StopPointName>Paris Austerlitz RER C</StopPointName>
      <AimedDepartureTime>2026-07-24T14:30:00Z</AimedDepartureTime>
      <ExpectedDepartureTime>2026-07-24T14:32:00Z</ExpectedDepartureTime>
      <DeparturePlatformName>3</DeparturePlatformName>
    </EstimatedCall>
    <EstimatedCall>
      <StopPointRef>FR:ScheduledStopPoint::87545137</StopPointRef>
      <StopPointName>Étampes</StopPointName>
      <AimedArrivalTime>2026-07-24T15:27:00Z</AimedArrivalTime>
      <ExpectedArrivalTime>2026-07-24T15:29:00Z</ExpectedArrivalTime>
      <ArrivalPlatformName>3</ArrivalPlatformName>
    </EstimatedCall>
  </EstimatedCalls>
</EstimatedVehicleJourney>

<EstimatedVehicleJourney>
  <LineRef>FR:Line::89BD9468:</LineRef>
  <FramedVehicleJourneyRef><DatedVehicleJourneyRef>FR:VehicleJourney::860589d366:LOC</DatedVehicleJourneyRef></FramedVehicleJourneyRef>
  <OriginName>Paris Austerlitz</OriginName>
  <DestinationName>Orléans</DestinationName>
  <EstimatedCalls>
    <EstimatedCall>
      <StopPointRef>FR:ScheduledStopPoint::87547000</StopPointRef>
      <StopPointName>Paris Austerlitz</StopPointName>
      <AimedDepartureTime>2026-07-24T14:35:00Z</AimedDepartureTime>
      <ExpectedDepartureTime>2026-07-24T14:35:00Z</ExpectedDepartureTime>
    </EstimatedCall>
    <EstimatedCall>
      <StopPointRef>FR:ScheduledStopPoint::87545137</StopPointRef>
      <StopPointName>Étampes</StopPointName>
      <AimedArrivalTime>2026-07-24T15:06:00Z</AimedArrivalTime>
      <ExpectedArrivalTime>2026-07-24T15:06:00Z</ExpectedArrivalTime>
      <AimedDepartureTime>2026-07-24T15:08:00Z</AimedDepartureTime>
      <ExpectedDepartureTime>2026-07-24T15:08:00Z</ExpectedDepartureTime>
      <ArrivalPlatformName>1</ArrivalPlatformName>
    </EstimatedCall>
  </EstimatedCalls>
</EstimatedVehicleJourney>

<EstimatedVehicleJourney>
  <LineRef>FR:Line::AAAA:</LineRef>
  <FramedVehicleJourneyRef><DatedVehicleJourneyRef>FR:VehicleJourney::860613f0fe:LOC</DatedVehicleJourneyRef></FramedVehicleJourneyRef>
  <OriginName>Paris Austerlitz</OriginName>
  <DestinationName>Châteaudun</DestinationName>
  <EstimatedCalls>
    <EstimatedCall>
      <StopPointRef>FR:ScheduledStopPoint::87547000</StopPointRef>
      <StopPointName>Paris Austerlitz</StopPointName>
      <AimedDepartureTime>2026-07-24T14:25:00Z</AimedDepartureTime>
      <ExpectedDepartureTime>2026-07-24T14:25:00Z</ExpectedDepartureTime>
    </EstimatedCall>
    <EstimatedCall>
      <StopPointRef>FR:ScheduledStopPoint::87411443</StopPointRef>
      <StopPointName>Châteaudun</StopPointName>
      <AimedArrivalTime>2026-07-24T16:00:00Z</AimedArrivalTime>
    </EstimatedCall>
  </EstimatedCalls>
</EstimatedVehicleJourney>

</EstimatedJourneyVersionFrame></EstimatedTimetableDelivery>
</ServiceDelivery></Siri>`;
