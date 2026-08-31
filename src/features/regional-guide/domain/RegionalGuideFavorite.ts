import type { SelectedRegion } from "./Region";

const REGIONAL_GUIDE_ID_PREFIX = "regional-guide:v1:";

export type RegionalGuideId = `${typeof REGIONAL_GUIDE_ID_PREFIX}${string}`;

export function createRegionalGuideId(
  region: SelectedRegion,
): RegionalGuideId | undefined {
  const targetRegion = region.eupmyeondong ?? region.sigungu;
  return targetRegion
    ? `${REGIONAL_GUIDE_ID_PREFIX}${encodeURIComponent(targetRegion.id)}`
    : undefined;
}

export function readRegionalGuideRegionId(guideId: string): string | undefined {
  if (!guideId.startsWith(REGIONAL_GUIDE_ID_PREFIX)) return undefined;

  const encodedRegionId = guideId.slice(REGIONAL_GUIDE_ID_PREFIX.length);
  if (!encodedRegionId) return undefined;

  try {
    const regionId = decodeURIComponent(encodedRegionId);
    return regionId || undefined;
  } catch {
    return undefined;
  }
}
