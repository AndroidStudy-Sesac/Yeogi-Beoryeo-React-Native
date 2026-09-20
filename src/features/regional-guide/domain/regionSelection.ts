import type { Region, RegionLevel, RegionSelection } from './Region';

export function selectRegion(
  current: RegionSelection,
  level: RegionLevel,
  region: Region,
): RegionSelection {
  if (region.level !== level) return current;

  switch (level) {
    case 'sido':
      return { sido: region };
    case 'sigungu':
      return { sido: current.sido, sigungu: region };
    case 'eupmyeondong':
      return { ...current, eupmyeondong: region };
  }
}
