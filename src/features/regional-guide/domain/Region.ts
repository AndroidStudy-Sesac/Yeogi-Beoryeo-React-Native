export type RegionLevel = "sido" | "sigungu" | "eupmyeondong";

export interface Region {
  id: string;
  name: string;
  level: RegionLevel;
  parentId?: string;
}

export interface SelectedRegion {
  sido?: Region;
  sigungu?: Region;
  eupmyeondong?: Region;
}
