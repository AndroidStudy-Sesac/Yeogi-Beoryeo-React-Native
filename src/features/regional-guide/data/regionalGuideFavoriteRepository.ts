import { findRegionById } from "./regionRepository";
import {
  readRegionalGuideRegionId,
  type RegionalGuideId,
} from "../domain/RegionalGuideFavorite";

export const REGIONAL_GUIDE_FAVORITES_STORAGE_KEY =
  "@yeogi-beoryeo/regional-guide-favorites";

const STORAGE_VERSION = 1;

export interface RegionalGuideFavoriteStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface RegionalGuideFavoriteRepository {
  restore(): Promise<RegionalGuideId[]>;
  save(guideIds: readonly RegionalGuideId[]): Promise<void>;
}

export function createRegionalGuideFavoriteRepository(
  storage: RegionalGuideFavoriteStorage,
  isKnownGuideId: (
    guideId: string,
  ) => guideId is RegionalGuideId = isKnownRegionalGuideId,
): RegionalGuideFavoriteRepository {
  return {
    async restore() {
      const storedValue = await storage.getItem(
        REGIONAL_GUIDE_FAVORITES_STORAGE_KEY,
      );
      return parseStoredFavoriteIds(storedValue, isKnownGuideId);
    },
    async save(guideIds) {
      const distinctGuideIds = [...new Set(guideIds)].filter(isKnownGuideId);
      await storage.setItem(
        REGIONAL_GUIDE_FAVORITES_STORAGE_KEY,
        JSON.stringify({
          version: STORAGE_VERSION,
          guideIds: distinctGuideIds,
        }),
      );
    },
  };
}

export function parseStoredFavoriteIds(
  storedValue: string | null,
  isKnownGuideId: (
    guideId: string,
  ) => guideId is RegionalGuideId = isKnownRegionalGuideId,
): RegionalGuideId[] {
  if (storedValue === null) return [];

  try {
    const parsedValue: unknown = JSON.parse(storedValue);
    if (!isFavoriteStoragePayload(parsedValue)) return [];

    return [...new Set(parsedValue.guideIds)].filter(isKnownGuideId);
  } catch {
    return [];
  }
}

export function isKnownRegionalGuideId(
  guideId: string,
): guideId is RegionalGuideId {
  const regionId = readRegionalGuideRegionId(guideId);
  const region = regionId ? findRegionById(regionId) : undefined;
  return region?.level === "sigungu" || region?.level === "eupmyeondong";
}

function isFavoriteStoragePayload(
  value: unknown,
): value is { version: 1; guideIds: string[] } {
  if (typeof value !== "object" || value === null) return false;

  const payload = value as Record<string, unknown>;
  return (
    payload.version === STORAGE_VERSION &&
    Array.isArray(payload.guideIds) &&
    payload.guideIds.every((guideId) => typeof guideId === "string")
  );
}
