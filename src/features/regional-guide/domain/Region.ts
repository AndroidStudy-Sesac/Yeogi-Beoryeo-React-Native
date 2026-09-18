export type RegionLevel = 'sido' | 'sigungu' | 'eupmyeondong';

export type Region = Readonly<{
  id: string;
  level: RegionLevel;
  name: string;
  parentId?: string;
}>;

export type RegionSelection = Readonly<{
  sido?: Region;
  sigungu?: Region;
  eupmyeondong?: Region;
}>;

export function formatRegionSelection(selection: RegionSelection): string {
  return [selection.sido, selection.sigungu, selection.eupmyeondong]
    .filter((region): region is Region => Boolean(region))
    .filter(region => region.name !== '없음')
    .map(region => region.name)
    .join(' > ');
}
