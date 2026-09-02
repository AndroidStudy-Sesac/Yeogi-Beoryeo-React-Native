import type { Region, RegionLevel } from "../domain/Region";

interface RegionalGuideRegionAssetItem {
  sidoName: string;
  sigunguName: string;
}

interface RegionalGuideAvailabilityAssetItem
  extends RegionalGuideRegionAssetItem {
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

export interface RegionAssetSourceStat {
  name: string;
  sourceBytes: number;
  rowCount: number;
}

export interface RegionAssetLoadMetrics {
  sources: readonly RegionAssetSourceStat[];
  sourceBytes: number;
  sourceRowCount: number;
  moduleAccessMilliseconds: number;
  transformationMilliseconds: number;
  totalMilliseconds: number;
  outputRegionCount: number;
  invalidRecordCount: number;
}

export const REGION_ASSET_SOURCE_STATS: readonly RegionAssetSourceStat[] = [
  { name: "배출 안내 지역", sourceBytes: 16_455, rowCount: 218 },
  { name: "행정구역", sourceBytes: 849_070, rowCount: 3_627 },
  { name: "제공 가능 지역", sourceBytes: 534_977, rowCount: 3_263 },
];

interface RegionAssetRuntime {
  result: RegionAssetLoadResult;
  metrics: RegionAssetLoadMetrics;
}

let cachedRegionAssetRuntime: RegionAssetRuntime | undefined;

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
  const scopeContexts = scopes.map((scope) => {
    const administrativeRegionsInScope = administrativeRegions.items.filter(
      (region) => isSameScope(scope, region),
    );
    const availabilityInScope = availability.items.filter((region) =>
      isSameScope(scope, region),
    );
    const sidoRegionId = sidoId(scope.sidoName, administrativeRegions.items);
    const administrativeRegion = administrativeRegionsInScope[0];
    const sigunguRegionId = administrativeRegion
      ? `sigungu:${administrativeRegion.adminCode.slice(0, 5)}`
      : `sigungu:${sidoRegionId}:${scope.sigunguName}`;

    return {
      scope,
      administrativeRegionsInScope,
      availabilityInScope,
      sidoRegionId,
      sigunguRegionId,
    };
  });
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
  const sigunguRegions = scopeContexts
    .sort((first, second) => byScope(first.scope, second.scope))
    .map(({ scope, sidoRegionId, sigunguRegionId }) =>
      toRegion("sigungu", scope.sigunguName, sidoRegionId, sigunguRegionId),
    );
  const eupmyeondongRegions = scopeContexts.flatMap(
    ({
      administrativeRegionsInScope,
      availabilityInScope,
      sigunguRegionId,
    }) => {
      const hasDetailedCoverage = availabilityInScope.some(
        hasEupmyeondongCoverage,
      );
      const availableAdministrativeRegions = hasDetailedCoverage
        ? administrativeRegionsInScope.filter((region) =>
            availabilityInScope.some((availableRegion) =>
              matchesEupmyeondong(availableRegion, region.eupmyeondongName),
            ),
          )
        : administrativeRegionsInScope;

      return distinctBy(
        availableAdministrativeRegions,
        (region) => region.eupmyeondongName,
      )
        .sort(byName((region) => region.eupmyeondongName))
        .map((region) =>
          toRegion(
            "eupmyeondong",
            region.eupmyeondongName,
            sigunguRegionId,
            `eupmyeondong:${region.adminCode}`,
          ),
        );
    },
  );

  return {
    regions: [...sidoRegions, ...sigunguRegions, ...eupmyeondongRegions],
    invalidRecordCount,
  };
}

export function findRegions(level: RegionLevel, parentId?: string): Region[] {
  return getRegionAssetRuntime().result.regions.filter(
    (region) => region.level === level && region.parentId === parentId,
  );
}

export function findRegionById(id: string): Region | undefined {
  return getRegionAssetRuntime().result.regions.find(
    (region) => region.id === id,
  );
}

export function getAvailableRegions(): Region[] {
  return [...getRegionAssetRuntime().result.regions];
}

export function getRegionAssetLoadResult(): RegionAssetLoadResult {
  return getRegionAssetRuntime().result;
}

export function getRegionAssetLoadMetrics(): RegionAssetLoadMetrics {
  return getRegionAssetRuntime().metrics;
}

/** 측정 패널에서만 호출하며 최초 asset 변환 시간에는 포함하지 않습니다. */
export function estimateRegionModelBytes(): number {
  return utf8ByteLength(JSON.stringify(getRegionAssetRuntime().result.regions));
}

function getRegionAssetRuntime(): RegionAssetRuntime {
  if (cachedRegionAssetRuntime) return cachedRegionAssetRuntime;

  const loadStartedAt = now();
  // 정적 경로 require를 함수 안에서 최초 한 번 평가해 Metro JSON 모듈 접근 비용을 잽니다.
  const regionalGuideRegionAsset: unknown = require("./regions.json");
  const administrativeRegionAsset: unknown = require("./assets/administrativeRegions.json");
  const regionalGuideAvailabilityAsset: unknown = require("./assets/regionalGuideAvailability.json");
  const moduleAccessMilliseconds = now() - loadStartedAt;
  const transformationStartedAt = now();
  const result = createRegionAssetLoadResult(
    regionalGuideRegionAsset,
    regionalGuideAvailabilityAsset,
    administrativeRegionAsset,
  );
  const transformationMilliseconds = now() - transformationStartedAt;
  const sourceBytes = REGION_ASSET_SOURCE_STATS.reduce(
    (total, source) => total + source.sourceBytes,
    0,
  );
  const sourceRowCount = REGION_ASSET_SOURCE_STATS.reduce(
    (total, source) => total + source.rowCount,
    0,
  );

  cachedRegionAssetRuntime = {
    result,
    metrics: {
      sources: REGION_ASSET_SOURCE_STATS,
      sourceBytes,
      sourceRowCount,
      moduleAccessMilliseconds,
      transformationMilliseconds,
      totalMilliseconds: moduleAccessMilliseconds + transformationMilliseconds,
      outputRegionCount: result.regions.length,
      invalidRecordCount: result.invalidRecordCount,
    },
  };
  return cachedRegionAssetRuntime;
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

function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes +=
      codePoint <= 0x7f
        ? 1
        : codePoint <= 0x7ff
          ? 2
          : codePoint <= 0xffff
            ? 3
            : 4;
  }
  return bytes;
}
