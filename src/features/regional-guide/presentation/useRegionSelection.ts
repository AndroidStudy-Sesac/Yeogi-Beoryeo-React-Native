import { useCallback, useMemo, useState } from 'react';

import { getRegionCatalog, type RegionCatalog } from '../data/regionRepository';
import type { Region, RegionLevel, RegionSelection } from '../domain/Region';
import { selectRegion as transitionSelection } from '../domain/regionSelection';

export function useRegionSelection(providedCatalog?: RegionCatalog) {
  const catalog = useMemo(
    () => providedCatalog ?? getRegionCatalog(),
    [providedCatalog],
  );
  const [selection, setSelection] = useState<RegionSelection>({});

  const selectRegion = useCallback((level: RegionLevel, region: Region) => {
    setSelection(current => transitionSelection(current, level, region));
  }, []);

  const selectPath = useCallback((nextSelection: RegionSelection) => {
    setSelection(nextSelection);
  }, []);

  return {
    selection,
    sidoRegions: catalog.findChildren('sido'),
    sigunguRegions: selection.sido
      ? catalog.findChildren('sigungu', selection.sido.id)
      : [],
    eupmyeondongRegions: selection.sigungu
      ? catalog.findChildren('eupmyeondong', selection.sigungu.id)
      : [],
    selectRegion,
    selectPath,
  };
}
