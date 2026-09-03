import { findRegionById } from "./regionRepository";
import {
  readRegionalGuideRegionId,
  type RegionalGuideId,
} from "../domain/RegionalGuideFavorite";
import type { Region, SelectedRegion } from "../domain/Region";

export function resolveRegionalGuideSelection(
  guideId: RegionalGuideId,
): SelectedRegion | undefined {
  const regionId = readRegionalGuideRegionId(guideId);
  const targetRegion = regionId ? findRegionById(regionId) : undefined;
  if (!targetRegion) return undefined;

  if (targetRegion.level === "sigungu") {
    const sido = findParent(targetRegion, "sido");
    return sido ? { sido, sigungu: targetRegion } : undefined;
  }

  if (targetRegion.level === "eupmyeondong") {
    const sigungu = findParent(targetRegion, "sigungu");
    const sido = sigungu ? findParent(sigungu, "sido") : undefined;
    return sido && sigungu
      ? { sido, sigungu, eupmyeondong: targetRegion }
      : undefined;
  }

  return undefined;
}

export function regionalGuideSelectionPath(selection: SelectedRegion): string {
  return [selection.sido, selection.sigungu, selection.eupmyeondong]
    .filter((region): region is Region => Boolean(region))
    .filter((region) => region.name !== "없음")
    .map((region) => region.name)
    .join(" > ");
}

function findParent(
  region: Region,
  expectedLevel: Region["level"],
): Region | undefined {
  const parent = region.parentId ? findRegionById(region.parentId) : undefined;
  return parent?.level === expectedLevel ? parent : undefined;
}
