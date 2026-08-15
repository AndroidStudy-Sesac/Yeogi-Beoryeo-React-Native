import { useMemo, useState } from "react";

import { findRegions } from "../data/regionRepository";
import type { Region, RegionLevel, SelectedRegion } from "../domain/Region";

export function useRegionalGuide() {
  const [selected, setSelected] = useState<SelectedRegion>({});

  const sidoRegions = useMemo(() => findRegions("sido"), []);
  const sigunguRegions = useMemo(
    () => (selected.sido ? findRegions("sigungu", selected.sido.id) : []),
    [selected.sido],
  );
  const eupmyeondongRegions = useMemo(
    () =>
      selected.sigungu ? findRegions("eupmyeondong", selected.sigungu.id) : [],
    [selected.sigungu],
  );

  const select = (level: RegionLevel, region: Region) => {
    setSelected((current) => {
      if (level === "sido") return { sido: region };
      if (level === "sigungu") return { sido: current.sido, sigungu: region };
      return { ...current, eupmyeondong: region };
    });
  };

  return { selected, sidoRegions, sigunguRegions, eupmyeondongRegions, select };
}
