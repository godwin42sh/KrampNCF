export interface LineDataFilters {
  lines?: string;
  commercial_modes?: string;
}

export interface LineData {
  id: number;
  title: string;
  stopAreaId: string;
  stopAreaName: string;
  stopFilters?: LineDataFilters;
  directionAreaId: string;
}
