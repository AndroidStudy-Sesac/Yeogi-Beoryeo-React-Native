import {
  createRegionalGuideId,
  type RegionalGuideId,
} from "../domain/RegionalGuideFavorite";
import type { Region } from "../domain/Region";
import {
  normalizeComparableRegionName,
  normalizeSidoName,
} from "../domain/regionNormalization";
import { getAvailableRegions } from "./regionRepository";
import type { LegacyRegionalGuideFavoriteReader } from "./legacyRegionalGuideFavoriteReader";
import type {
  RegionalGuideFavoriteRepository,
  RegionalGuideFavoriteStorage,
} from "./regionalGuideFavoriteRepository";

export const REGIONAL_GUIDE_FAVORITES_MIGRATION_STORAGE_KEY =
  "@yeogi-beoryeo/migration/android-room-regional-guide-favorites";

const MIGRATION_VERSION = 1;
const COMPLETED_MARKER = JSON.stringify({
  version: MIGRATION_VERSION,
  status: "completed",
});

type MigrationResult =
  | { status: "already-completed" }
  | { status: "not-applicable" }
  | { status: "completed"; migratedCount: number; skippedCount: number }
  | { status: "retryable-failure" };

interface LegacyFavoriteFields {
  sido?: string;
  sigungu?: string;
  eupmyeondong?: string;
  targetRegionName?: string;
  managementZoneName?: string;
}

interface LegacyFavoriteRow extends LegacyFavoriteFields {
  targetId: string;
}

type NativeReadResult =
  | { status: "database-missing" }
  | { status: "ready"; favorites: unknown[] }
  | { status: "unavailable" | "unreadable" };

export function createMigratingRegionalGuideFavoriteRepository(
  repository: RegionalGuideFavoriteRepository,
  storage: RegionalGuideFavoriteStorage,
  reader: LegacyRegionalGuideFavoriteReader,
): RegionalGuideFavoriteRepository {
  let migration: Promise<MigrationResult> | undefined;

  return {
    async restore() {
      migration ??= runRegionalGuideFavoriteMigration(
        repository,
        storage,
        reader,
      );
      await migration;
      return repository.restore();
    },
    save(guideIds) {
      return repository.save(guideIds);
    },
  };
}

export async function runRegionalGuideFavoriteMigration(
  repository: RegionalGuideFavoriteRepository,
  storage: RegionalGuideFavoriteStorage,
  reader: LegacyRegionalGuideFavoriteReader,
): Promise<MigrationResult> {
  try {
    const marker = await storage.getItem(
      REGIONAL_GUIDE_FAVORITES_MIGRATION_STORAGE_KEY,
    );
    if (isCompletedMarker(marker)) return { status: "already-completed" };

    const readResult = parseNativeReadResult(await reader.read());
    if (readResult === undefined) return { status: "retryable-failure" };
    if (readResult.status === "unavailable") {
      return { status: "not-applicable" };
    }
    if (readResult.status === "unreadable") {
      return { status: "retryable-failure" };
    }

    const existingGuideIds = await repository.restore();
    const migration =
      readResult.status === "ready"
        ? mapLegacyRegionalGuideFavorites(readResult.favorites)
        : { guideIds: [], skippedCount: 0 };
    const mergedGuideIds = [
      ...new Set([...existingGuideIds, ...migration.guideIds]),
    ];

    if (!areEqual(existingGuideIds, mergedGuideIds)) {
      await repository.save(mergedGuideIds);
    }
    await storage.setItem(
      REGIONAL_GUIDE_FAVORITES_MIGRATION_STORAGE_KEY,
      COMPLETED_MARKER,
    );

    return {
      status: "completed",
      migratedCount: migration.guideIds.length,
      skippedCount: migration.skippedCount,
    };
  } catch {
    return { status: "retryable-failure" };
  }
}

export function mapLegacyRegionalGuideFavorites(
  values: readonly unknown[],
  regions: readonly Region[] = getAvailableRegions(),
): { guideIds: RegionalGuideId[]; skippedCount: number } {
  const guideIds = new Set<RegionalGuideId>();
  let skippedCount = 0;

  for (const value of values) {
    const row = parseLegacyFavoriteRow(value);
    const guideId = row ? mapLegacyFavoriteToGuideId(row, regions) : undefined;
    if (guideId) guideIds.add(guideId);
    else skippedCount += 1;
  }

  return { guideIds: [...guideIds], skippedCount };
}

export function decodeLegacyRegionalGuideFavoriteKey(
  targetId: string,
): LegacyFavoriteFields | undefined {
  const delimiterIndex = targetId.indexOf("|");
  if (delimiterIndex < 0) return undefined;

  const version = targetId.slice(0, delimiterIndex);
  const fieldCount =
    version === "regional-guide-v1"
      ? 4
      : version === "regional-guide-v2"
        ? 5
        : undefined;
  if (fieldCount === undefined) return undefined;

  const fields: Array<string | undefined> = [];
  let cursor = delimiterIndex + 1;
  for (let index = 0; index < fieldCount; index += 1) {
    const lengthDelimiterIndex = targetId.indexOf(":", cursor);
    if (lengthDelimiterIndex < 0) return undefined;

    const lengthText = targetId.slice(cursor, lengthDelimiterIndex);
    if (!/^-?\d+$/.test(lengthText)) return undefined;
    const length = Number(lengthText);
    cursor = lengthDelimiterIndex + 1;

    if (length === -1) {
      fields.push(undefined);
      continue;
    }
    if (!Number.isSafeInteger(length) || length < 0) return undefined;

    const end = cursor + length;
    if (end > targetId.length) return undefined;
    fields.push(targetId.slice(cursor, end));
    cursor = end;
  }

  if (cursor !== targetId.length) return undefined;
  const decoded = {
    sido: normalizeOptional(fields[0]),
    sigungu: normalizeOptional(fields[1]),
    eupmyeondong: normalizeOptional(fields[2]),
    targetRegionName: normalizeOptional(fields[3]),
    managementZoneName: normalizeOptional(fields[4]),
  };

  return decoded.sido || decoded.sigungu ? decoded : undefined;
}

function mapLegacyFavoriteToGuideId(
  row: LegacyFavoriteRow,
  regions: readonly Region[],
): RegionalGuideId | undefined {
  const decodedKey = decodeLegacyRegionalGuideFavoriteKey(row.targetId);
  if (decodedKey === undefined) return undefined;

  const sigunguName = normalizeOptional(row.sigungu) ?? decodedKey.sigungu;
  const sidoName = normalizeSidoName(
    normalizeOptional(row.sido) ?? decodedKey.sido,
    sigunguName,
  );
  if (!sidoName) return undefined;

  const sido = regions.find(
    (region) =>
      region.level === "sido" &&
      comparable(region.name) === comparable(sidoName),
  );
  if (!sido) return undefined;

  const resolvedSigunguName =
    sigunguName ?? (sido.name === "세종특별자치시" ? "없음" : undefined);
  if (!resolvedSigunguName) return undefined;

  const sigungu = findSigungu(regions, sido.id, resolvedSigunguName);
  if (!sigungu) return undefined;

  const eupmyeondongName =
    normalizeOptional(row.eupmyeondong) ?? decodedKey.eupmyeondong;
  const eupmyeondong = eupmyeondongName
    ? regions.find(
        (region) =>
          region.level === "eupmyeondong" &&
          region.parentId === sigungu.id &&
          comparable(region.name) === comparable(eupmyeondongName),
      )
    : undefined;
  if (eupmyeondongName && !eupmyeondong) return undefined;

  return createRegionalGuideId({ sido, sigungu, eupmyeondong });
}

function findSigungu(
  regions: readonly Region[],
  sidoId: string,
  sigunguName: string,
): Region | undefined {
  const candidates = regions.filter(
    (region) => region.level === "sigungu" && region.parentId === sidoId,
  );
  const sourceName = comparable(sigunguName);
  const exactMatch = candidates.find(
    (region) => comparable(region.name) === sourceName,
  );
  if (exactMatch) return exactMatch;

  return candidates
    .filter((region) => sourceName.startsWith(comparable(region.name)))
    .sort(
      (first, second) =>
        comparable(second.name).length - comparable(first.name).length,
    )[0];
}

function parseLegacyFavoriteRow(value: unknown): LegacyFavoriteRow | undefined {
  if (!isRecord(value) || typeof value.targetId !== "string") return undefined;

  return {
    targetId: value.targetId,
    sido: readOptionalString(value.sido),
    sigungu: readOptionalString(value.sigungu),
    eupmyeondong: readOptionalString(value.eupmyeondong),
    targetRegionName: readOptionalString(value.targetRegionName),
    managementZoneName: readOptionalString(value.managementZoneName),
  };
}

function parseNativeReadResult(value: unknown): NativeReadResult | undefined {
  if (!isRecord(value) || typeof value.status !== "string") return undefined;
  if (value.status === "database-missing") {
    return { status: "database-missing" };
  }
  if (value.status === "unavailable" || value.status === "unreadable") {
    return { status: value.status };
  }
  if (value.status === "ready" && Array.isArray(value.favorites)) {
    return { status: "ready", favorites: value.favorites };
  }
  return undefined;
}

function isCompletedMarker(value: string | null): boolean {
  if (value === null) return false;

  try {
    const marker: unknown = JSON.parse(value);
    return (
      isRecord(marker) &&
      marker.version === MIGRATION_VERSION &&
      marker.status === "completed"
    );
  } catch {
    return false;
  }
}

function areEqual(
  first: readonly RegionalGuideId[],
  second: readonly RegionalGuideId[],
): boolean {
  return (
    first.length === second.length &&
    first.every((guideId, index) => guideId === second[index])
  );
}

function comparable(value: string): string {
  return normalizeComparableRegionName(value);
}

function normalizeOptional(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? normalizeOptional(value) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
