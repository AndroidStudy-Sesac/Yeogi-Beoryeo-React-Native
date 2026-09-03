import { isKnownRegionalGuideId } from "./regionalGuideFavoriteRepository";
import type { RegionalGuideFavoriteStorage } from "./regionalGuideFavoriteRepository";
import type { RegionalGuideId } from "../domain/RegionalGuideFavorite";

export const HOME_REGIONAL_GUIDE_REPRESENTATIVE_STORAGE_KEY =
  "@yeogi-beoryeo/home-regional-guide-representative";

const STORAGE_VERSION = 1;

export interface HomeRegionalGuideRepresentativeRepository {
  restore(): Promise<RegionalGuideId | undefined>;
  save(guideId: RegionalGuideId | undefined): Promise<void>;
}

export function createHomeRegionalGuideRepresentativeRepository(
  storage: RegionalGuideFavoriteStorage,
  isKnownGuideId: (
    guideId: string,
  ) => guideId is RegionalGuideId = isKnownRegionalGuideId,
): HomeRegionalGuideRepresentativeRepository {
  return {
    async restore() {
      return parseStoredRepresentativeGuideId(
        await storage.getItem(HOME_REGIONAL_GUIDE_REPRESENTATIVE_STORAGE_KEY),
        isKnownGuideId,
      );
    },
    async save(guideId) {
      await storage.setItem(
        HOME_REGIONAL_GUIDE_REPRESENTATIVE_STORAGE_KEY,
        JSON.stringify({
          version: STORAGE_VERSION,
          guideId: guideId && isKnownGuideId(guideId) ? guideId : null,
        }),
      );
    },
  };
}

export function parseStoredRepresentativeGuideId(
  storedValue: string | null,
  isKnownGuideId: (
    guideId: string,
  ) => guideId is RegionalGuideId = isKnownRegionalGuideId,
): RegionalGuideId | undefined {
  if (storedValue === null) return undefined;

  try {
    const parsedValue: unknown = JSON.parse(storedValue);
    if (!isRepresentativeStoragePayload(parsedValue)) return undefined;
    return parsedValue.guideId && isKnownGuideId(parsedValue.guideId)
      ? parsedValue.guideId
      : undefined;
  } catch {
    return undefined;
  }
}

function isRepresentativeStoragePayload(
  value: unknown,
): value is { version: 1; guideId: string | null } {
  if (typeof value !== "object" || value === null) return false;

  const payload = value as Record<string, unknown>;
  return (
    payload.version === STORAGE_VERSION &&
    (typeof payload.guideId === "string" || payload.guideId === null)
  );
}
