import { TrainType } from './CrawlFlareDeparture';

export interface LineDataFilters {
  lines?: string;
  commercial_modes?: string;
}

export interface LineData {
  id: number;
  title: string;
  destinationName: string;
  stopAreaId: string;
  stopAreaName: string;
  stopFilters?: LineDataFilters;
  directionAreaId: string;
  gtfsId: string;
  gtfsIdTo?: string;
  primDataId: number;
  crawlUrlParam: string;
  crawlDataId: number;
  crawlDataTrainType: TrainType,
}
