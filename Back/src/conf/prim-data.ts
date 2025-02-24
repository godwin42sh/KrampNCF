import { PrimData } from '../types/PrimData';

const primsData: PrimData[] = [
  {
    id: 1,
    departureName: 'Étampes',
    destinationName: 'Austerlitz',
    primDepartureRef: 'STIF:StopPoint:Q:41298:',
    primDestinationRef: 'STIF:StopPoint:Q:41333:',
    primLineRef: 'STIF:Line::C01857:',
    type: 'TER',
  },
  {
    id: 2,
    departureName: 'Austerlitz',
    destinationName: 'Étampes',
    primDepartureRef: 'STIF:StopPoint:Q:41333:',
    primDestinationRef: 'SNCF_ACCES_CLOUD:StopPoint:Q:87543009:LOC',
    primLineRef: 'STIF:Line::C01857:',
    type: 'TER',
  },
  {
    id: 3,
    departureName: 'Étampes RER',
    destinationName: 'Austerlitz',
    primDepartureRef: 'STIF:StopPoint:Q:41298:',
    primJourneyNote: ['SARA', 'ORET', 'VETO'],
    primLineRef: 'STIF:Line::C01727:',
    type: 'RER',
  },
  {
    id: 4,
    departureName: 'Austerlitz RER',
    destinationName: 'Étampes',
    primDepartureRef: 'STIF:StopPoint:Q:41333:',
    primJourneyNote: ['ELAO', 'ELBA'],
    primLineRef: 'STIF:Line::C01727:',
    type: 'RER',
  },
];

export default primsData;
