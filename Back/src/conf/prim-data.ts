import { PrimData } from '../types/PrimData';

const primsData: PrimData[] = [
  {
    id: 1,
    departureName: 'Étampes',
    destinationName: 'Austerlitz',
    primDepartureRef: 'STIF:StopPoint:Q:41298:',
    primDestinationRef: 'STIF:StopPoint:Q:41333:',
    primLineRef: 'STIF:Line::C01857:',
  },
  {
    id: 2,
    departureName: 'Austerlitz',
    destinationName: 'Étampes',
    primDepartureRef: 'STIF:StopPoint:Q:41333:',
    primDestinationRef: 'SNCF_ACCES_CLOUD:StopPoint:Q:87543009:LOC',
    // primDestinationRef: 'STIF:StopPoint:Q:41298:',
    primLineRef: 'STIF:Line::C01857:',
  },
  {
    id: 3,
    departureName: 'Étampes RER',
    destinationName: 'Austerlitz RER',
    // primDestinationRef: 'STIF:StopPoint:Q:41333:',
    primDepartureRef: 'STIF:StopPoint:Q:41298:',
    primDestinationRef: 'STIF:StopPoint:Q:41251:',
    primLineRef: 'STIF:Line::C01727:',
  },
  {
    id: 4,
    departureName: 'Austerlitz RER',
    destinationName: 'Étampes RER',
    primDestinationRef: 'STIF:StopPoint:Q:41298:',
    primDepartureRef: 'STIF:StopPoint:Q:41251:',
    // primDepartureRef: 'STIF:StopPoint:Q:41333:',
    primLineRef: 'STIF:Line::C01727:',
  },
];

export default primsData;
