import administrativeRegionAsset from "./assets/administrativeRegions.json";
import regionalGuideAvailabilityAsset from "./assets/regionalGuideAvailability.json";
import regionAsset from "./regions.json";
import type { Region, RegionLevel } from "../domain/Region";

interface RegionalGuideRegionAssetItem {
  sidoName: string;
  sigunguName: string;
}

interface RegionalGuideAvailabilityAssetItem extends RegionalGuideRegionAssetItem {
  managementZoneName: string;
  targetRegionName: string;
}

interface AdministrativeRegionAssetItem extends RegionalGuideRegionAssetItem {
  adminCode: string;
  eupmyeondongName: string;
}

export interface RegionAssetLoadResult {
  regions: Region[];
  invalidRecordCount: number;
}

const regionAssetLoadResult = createRegionAssetLoadResult(
  regionAsset,
  regionalGuideAvailabilityAsset,
  administrativeRegionAsset,
);

export function createRegionAssetLoadResult(
  regionalGuideRegionAsset: unknown,
  regionalGuideAvailabilityAsset: unknown,
  administrativeRegionAsset: unknown,
): RegionAssetLoadResult {
  const guideRegions = parseGuideRegions(regionalGuideRegionAsset);
  const availability = parseAvailability(regionalGuideAvailabilityAsset);
  const administrativeRegions = parseAdministrativeRegions(
    administrativeRegionAsset,
  );
  const invalidRecordCount =
    guideRegions.invalidRecordCount +
    availability.invalidRecordCount +
    administrativeRegions.invalidRecordCount;

  const availableScopes =
    availability.items.length > 0
      ? availability.items.map(toScope)
      : guideRegions.items.map(toScope);
  const guideScopeByKey = new Map(
    guideRegions.items.map((region) => [scopeKey(region), region]),
  );
  const scopes = distinctBy(availableScopes, scopeKey).map(
    (scope) => guideScopeByKey.get(scopeKey(scope)) ?? scope,
  );
  const sidoRegions = distinctBy(scopes, (scope) => scope.sidoName)
    .sort(byName((scope) => scope.sidoName))
    .map((scope) =>
      toRegion(
        "sido",
        scope.sidoName,
        undefined,
        sidoId(scope.sidoName, administrativeRegions.items),
      ),
    );
  const sigunguRegions = scopes
    .sort(byScope)
    .map((scope) =>
      toRegion(
        "sigungu",
        scope.sigunguName,
        sidoId(scope.sidoName, administrativeRegions.items),
        sigunguId(scope, administrativeRegions.items),
      ),
    );
  const eupmyeondongRegions = scopes.flatMap((scope) => {
    const administrationInScope = administrativeRegions.items.filter((region) =>
      isSameScope(scope, region),
    );
    const availabilityInScope = availability.items.filter((region) =>
      isSameScope(scope, region),
    );
    const hasDetailedCoverage = availabilityInScope.some(
      hasEupmyeondongCoverage,
    );
    const availableAdministrativeRegions = hasDetailedCoverage
      ? administrationInScope.filter((region) =>
          availabilityInScope.some((availableRegion) =>
            matchesEupmyeondong(availableRegion, region.eupmyeondongName),
          ),
        )
      : administrationInScope;

    return distinctBy(
      availableAdministrativeRegions,
      (region) => region.eupmyeondongName,
    )
      .sort(byName((region) => region.eupmyeondongName))
      .map((region) =>
        toRegion(
          "eupmyeondong",
          region.eupmyeondongName,
          sigunguId(scope, administrativeRegions.items),
          `eupmyeondong:${region.adminCode}`,
        ),
      );
  });

  return {
    regions: [...sidoRegions, ...sigunguRegions, ...eupmyeondongRegions],
    invalidRecordCount,
  };
}

export function findRegions(level: RegionLevel, parentId?: string): Region[] {
  return regionAssetLoadResult.regions.filter(
    (region) => region.level === level && region.parentId === parentId,
  );
}

export function findRegionById(id: string): Region | undefined {
  return regionAssetLoadResult.regions.find((region) => region.id === id);
}

export function getAvailableRegions(): Region[] {
  return [...regionAssetLoadResult.regions];
}

export function getRegionAssetLoadResult(): RegionAssetLoadResult {
  return regionAssetLoadResult;
}

function parseGuideRegions(
  asset: unknown,
): ParseResult<RegionalGuideRegionAssetItem> {
  return parseAsset(asset, (item) => {
    const sidoName = readRequiredString(item, "sidoName");
    const sigunguName = readRequiredString(item, "sigunguName");
    return sidoName && sigunguName ? { sidoName, sigunguName } : undefined;
  });
}

function parseAvailability(
  asset: unknown,
): ParseResult<RegionalGuideAvailabilityAssetItem> {
  return parseAsset(asset, (item) => {
    const sidoName = readRequiredString(item, "sidoName");
    const sigunguName = readRequiredString(item, "sigunguName");
    const managementZoneName = readRequiredString(item, "managementZoneName");
    const targetRegionName = readRequiredString(item, "targetRegionName");
    return sidoName && sigunguName && managementZoneName && targetRegionName
      ? { sidoName, sigunguName, managementZoneName, targetRegionName }
      : undefined;
  });
}

function parseAdministrativeRegions(
  asset: unknown,
): ParseResult<AdministrativeRegionAssetItem> {
  return parseAsset(asset, (item) => {
    const adminCode = readRequiredString(item, "adminCode");
    const sidoName = readRequiredString(item, "sidoName");
    const sigunguName =
      readRequiredString(item, "sigunguName") ??
      (sidoName === "세종특별자치시" ? "없음" : undefined);
    const eupmyeondongName = readRequiredString(item, "eupmyeondongName");
    return adminCode && sidoName && sigunguName && eupmyeondongName
      ? { adminCode, sidoName, sigunguName, eupmyeondongName }
      : undefined;
  });
}

function parseAsset<T>(
  asset: unknown,
  parser: (item: Record<string, unknown>) => T | undefined,
): ParseResult<T> {
  if (!Array.isArray(asset)) return { items: [], invalidRecordCount: 1 };

  const items: T[] = [];
  let invalidRecordCount = 0;
  for (const item of asset) {
    if (!isRecord(item)) {
      invalidRecordCount += 1;
      continue;
    }

    const parsedItem = parser(item);
    if (parsedItem) items.push(parsedItem);
    else invalidRecordCount += 1;
  }

  return { items, invalidRecordCount };
}

function readRequiredString(
  item: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = item[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function hasEupmyeondongCoverage(
  region: RegionalGuideAvailabilityAssetItem,
): boolean {
  return [region.managementZoneName, region.targetRegionName].some((name) =>
    name
      .split(/[,+/]/)
      .some(
        (part) =>
          /[읍면동]$/.test(normalizeName(part)) ||
          /(?:동지역|읍면지역)$/.test(normalizeName(part)),
      ),
  );
}

function matchesEupmyeondong(
  region: RegionalGuideAvailabilityAssetItem,
  eupmyeondongName: string,
): boolean {
  const normalizedEupmyeondong = normalizeName(eupmyeondongName);
  return [region.managementZoneName, region.targetRegionName].some((name) =>
    name.split(/[,+/]/).some((part) => {
      const normalizedPart = normalizeName(part);
      return (
        normalizedPart === normalizedEupmyeondong ||
        normalizedPart.replace(/제(?=\d)/g, "") ===
          normalizedEupmyeondong.replace(/제(?=\d)/g, "") ||
        (normalizedPart === "동지역" &&
          normalizedEupmyeondong.endsWith("동")) ||
        (normalizedPart === "읍면지역" &&
          /[읍면]$/.test(normalizedEupmyeondong))
      );
    }),
  );
}

function toScope(
  region: RegionalGuideRegionAssetItem,
): RegionalGuideRegionAssetItem {
  return { sidoName: region.sidoName, sigunguName: region.sigunguName };
}

function isSameScope(
  first: RegionalGuideRegionAssetItem,
  second: RegionalGuideRegionAssetItem,
): boolean {
  return (
    first.sidoName === second.sidoName &&
    isSameSigunguScope(first.sigunguName, second.sigunguName)
  );
}

function isSameSigunguScope(first: string, second: string): boolean {
  const firstName = first.trim();
  const secondName = second.trim();
  const firstKey = normalizeSigungu(firstName);
  const secondKey = normalizeSigungu(secondName);

  return (
    firstKey === secondKey ||
    firstName.startsWith(`${secondName} `) ||
    secondName.startsWith(`${firstName} `)
  );
}

function scopeKey(region: RegionalGuideRegionAssetItem): string {
  return `${region.sidoName}:${normalizeSigungu(region.sigunguName)}`;
}

function sidoId(
  sidoName: string,
  administrativeRegions: AdministrativeRegionAssetItem[],
): string {
  const adminCode = administrativeRegions.find(
    (region) => region.sidoName === sidoName,
  )?.adminCode;
  return adminCode ? `sido:${adminCode.slice(0, 2)}` : `sido:${sidoName}`;
}

function sigunguId(
  scope: RegionalGuideRegionAssetItem,
  administrativeRegions: AdministrativeRegionAssetItem[],
): string {
  const adminCode = administrativeRegions.find((region) =>
    isSameScope(scope, region),
  )?.adminCode;
  return adminCode
    ? `sigungu:${adminCode.slice(0, 5)}`
    : `sigungu:${sidoId(scope.sidoName, administrativeRegions)}:${scope.sigunguName}`;
}

function toRegion(
  level: RegionLevel,
  name: string,
  parentId: string | undefined,
  id: string,
): Region {
  return { id, name, level, parentId };
}

function normalizeSigungu(sigunguName: string): string {
  return sigunguName.trim().replace(/시$/, "");
}

function normalizeName(name: string): string {
  return name.replace(/\s/g, "").trim();
}

function distinctBy<T>(items: T[], keySelector: (item: T) => string): T[] {
  return [...new Map(items.map((item) => [keySelector(item), item])).values()];
}

function byName<T>(
  selector: (item: T) => string,
): (first: T, second: T) => number {
  return (first, second) =>
    selector(first).localeCompare(selector(second), "ko");
}

function byScope(
  first: RegionalGuideRegionAssetItem,
  second: RegionalGuideRegionAssetItem,
): number {
  return (
    first.sidoName.localeCompare(second.sidoName, "ko") ||
    first.sigunguName.localeCompare(second.sigunguName, "ko")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

interface ParseResult<T> {
  items: T[];
  invalidRecordCount: number;
}
