import { TrainType } from '../types/CrawlFlareDeparture';
import { LineData } from '../types/LineData';

const linesData: LineData[] = [
  {
    id: 1,
    title: 'Étampes',
    destinationName: 'Austerlitz',
    gtfsId: 'StopPoint:OCETrain TER-87545137',
    gtfsIdTo: 'StopPoint:OCETrain TER-87547000',
    stopAreaId: 'stop_area:IDFM:478855',
    stopAreaName: 'Étampes',
    stopFilters: {
      lines: 'line:IDFM:C01857',
      commercial_modes: 'commercial_mode:regionalRail',
    },
    directionAreaId: 'stop_area:IDFM:71135',
    primDataId: 1,
    crawlUrlParam: 'etampes-87545137',
    crawlDataId: 1,
    crawlDataTrainType: 'TER' as TrainType,
  },
  {
    id: 2,
    title: 'Austerlitz',
    destinationName: 'Étampes',
    gtfsId: 'StopPoint:OCETrain TER-87547000',
    gtfsIdTo: 'StopPoint:OCETrain TER-87545137',
    stopAreaId: 'stop_area:IDFM:71135',
    stopAreaName: 'Gare d\'Austerlitz',
    stopFilters: {
      lines: 'line:IDFM:C01857',
      commercial_modes: 'commercial_mode:regionalRail',
    },
    directionAreaId: 'stop_area:IDFM:59403',
    primDataId: 2,
    crawlUrlParam: 'paris-austerlitz-87547000',
    crawlDataId: 2,
    crawlDataTrainType: 'TER' as TrainType,
  },
];

export default linesData;
