import { LineData } from '../types/LineData';

const linesData: LineData[] = [
  {
    id: 1,
    title: 'Ter Étampes - Paris',
    stopAreaId: 'stop_area:IDFM:478855',
    stopAreaName: 'Étampes',
    stopFilters: {
      lines: 'line:IDFM:C01857',
      commercial_modes: 'commercial_mode:regionalRail',
    },
    directionAreaId: 'stop_area:IDFM:71135',
  },
  {
    id: 2,
    title: 'Ter Paris - Étampes',
    stopAreaId: 'stop_area:IDFM:71135',
    stopAreaName: 'Gare d\'Austerlitz',
    stopFilters: {
      lines: 'line:IDFM:C01857',
      commercial_modes: 'commercial_mode:regionalRail',
    },
    directionAreaId: 'stop_area:IDFM:59403',
  },
];

export default linesData;
