import type { Region, RegionLevel } from '../domain/Region';

type GuideScopeRow = Readonly<{
  sidoName: string;
  sigunguName: string;
}>;

type AvailabilityRow = GuideScopeRow &
  Readonly<{
    managementZoneName: string;
    targetRegionName: string;
  }>;

type AdministrativeRegionRow = GuideScopeRow &
  Readonly<{
    adminCode: string;
    eupmyeondongName: string;
  }>;

export type RegionCatalog = Readonly<{
  regions: readonly Region[];
  invalidRowCount: number;
  findById(id: string): Region | undefined;
  findChildren(level: RegionLevel, parentId?: string): readonly Region[];
}>;

type ParsedRows<T> = Readonly<{
  values: readonly T[];
  invalidRowCount: number;
}>;

let regionCatalog: RegionCatalog | undefined;

export function getRegionCatalog(): RegionCatalog {
  if (regionCatalog) return regionCatalog;

  const guideScopes: unknown = require('./regions.json');
  const administrativeRegions: unknown = require('./assets/administrativeRegions.json');
  const availability: unknown = require('./assets/regionalGuideAvailability.json');
  regionCatalog = createRegionCatalog(
    guideScopes,
    availability,
    administrativeRegions,
  );
  return regionCatalog;
}

export function createRegionCatalog(
  rawGuideScopes: unknown,
  rawAvailability: unknown,
  rawAdministrativeRegions: unknown,
): RegionCatalog {
  const guideScopes = parseRows(rawGuideScopes, readGuideScope);
  const availability = parseRows(rawAvailability, readAvailability);
  const administrativeRegions = parseRows(
    rawAdministrativeRegions,
    readAdministrativeRegion,
  );
  const sourceScopes =
    availability.values.length > 0 ? availability.values : guideScopes.values;
  const guideScopeByKey = new Map(
    guideScopes.values.map(scope => [scopeKey(scope), scope]),
  );
  const scopes = uniqueBy(
    sourceScopes.map(toGuideScope),
    scopeKey,
  ).map(scope => guideScopeByKey.get(scopeKey(scope)) ?? scope);

  const sidoRegions = uniqueBy(scopes, scope => scope.sidoName)
    .sort(compareBy(scope => scope.sidoName))
    .map(scope => ({
      id: createSidoId(scope.sidoName, administrativeRegions.values),
      level: 'sido' as const,
      name: scope.sidoName,
    }));

  const regions: Region[] = [...sidoRegions];
  for (const scope of [...scopes].sort(compareScopes)) {
    const administrativeRows = administrativeRegions.values.filter(row =>
      belongsToScope(scope, row),
    );
    const availabilityRows = availability.values.filter(row =>
      belongsToScope(scope, row),
    );
    const sidoId = createSidoId(scope.sidoName, administrativeRegions.values);
    const sigunguId = createSigunguId(scope, sidoId, administrativeRows);
    regions.push({
      id: sigunguId,
      level: 'sigungu',
      name: scope.sigunguName,
      parentId: sidoId,
    });

    const selectableRows = availabilityRows.some(hasLocalCoverage)
      ? administrativeRows.filter(administrativeRow =>
          availabilityRows.some(availableRow =>
            coversAdministrativeRegion(availableRow, administrativeRow),
          ),
        )
      : administrativeRows;

    const eupmyeondongRegions = uniqueBy(
      selectableRows,
      row => row.eupmyeondongName,
    )
      .sort(compareBy(row => row.eupmyeondongName))
      .map(row => ({
        id: `eupmyeondong:${row.adminCode}`,
        level: 'eupmyeondong' as const,
        name: row.eupmyeondongName,
        parentId: sigunguId,
      }));
    regions.push(...eupmyeondongRegions);
  }

  const stableRegions = uniqueBy(regions, region => region.id);
  const byId = new Map(stableRegions.map(region => [region.id, region]));
  const childrenByParent = new Map<string, Region[]>();
  for (const region of stableRegions) {
    const key = childKey(region.level, region.parentId);
    const children = childrenByParent.get(key) ?? [];
    children.push(region);
    childrenByParent.set(key, children);
  }

  return {
    regions: stableRegions,
    invalidRowCount:
      guideScopes.invalidRowCount +
      availability.invalidRowCount +
      administrativeRegions.invalidRowCount,
    findById: id => byId.get(id),
    findChildren: (level, parentId) =>
      childrenByParent.get(childKey(level, parentId)) ?? [],
  };
}

function parseRows<T>(
  input: unknown,
  parse: (row: Record<string, unknown>) => T | undefined,
): ParsedRows<T> {
  if (!Array.isArray(input)) return { values: [], invalidRowCount: 1 };

  const values: T[] = [];
  let invalidRowCount = 0;
  for (const item of input) {
    const value = isRecord(item) ? parse(item) : undefined;
    if (value) values.push(value);
    else invalidRowCount += 1;
  }
  return { values, invalidRowCount };
}

function readGuideScope(row: Record<string, unknown>): GuideScopeRow | undefined {
  const sidoName = readString(row.sidoName);
  const sigunguName = readString(row.sigunguName);
  return sidoName && sigunguName ? { sidoName, sigunguName } : undefined;
}

function readAvailability(
  row: Record<string, unknown>,
): AvailabilityRow | undefined {
  const scope = readGuideScope(row);
  const managementZoneName = readString(row.managementZoneName);
  const targetRegionName = readString(row.targetRegionName);
  return scope && managementZoneName && targetRegionName
    ? { ...scope, managementZoneName, targetRegionName }
    : undefined;
}

function readAdministrativeRegion(
  row: Record<string, unknown>,
): AdministrativeRegionRow | undefined {
  const adminCode = readString(row.adminCode);
  const sidoName = readString(row.sidoName);
  const sigunguName =
    readString(row.sigunguName) ??
    (sidoName === '세종특별자치시' ? '없음' : undefined);
  const eupmyeondongName = readString(row.eupmyeondongName);
  return adminCode && sidoName && sigunguName && eupmyeondongName
    ? { adminCode, sidoName, sigunguName, eupmyeondongName }
    : undefined;
}

function createSidoId(
  sidoName: string,
  administrativeRegions: readonly AdministrativeRegionRow[],
): string {
  const code = administrativeRegions.find(row => row.sidoName === sidoName)
    ?.adminCode;
  return code ? `sido:${code.slice(0, 2)}` : `sido:${sidoName}`;
}

function createSigunguId(
  scope: GuideScopeRow,
  sidoId: string,
  administrativeRows: readonly AdministrativeRegionRow[],
): string {
  const code = administrativeRows[0]?.adminCode;
  return code
    ? `sigungu:${code.slice(0, 5)}`
    : `sigungu:${sidoId}:${scope.sigunguName}`;
}

function belongsToScope(first: GuideScopeRow, second: GuideScopeRow): boolean {
  if (first.sidoName !== second.sidoName) return false;

  const firstName = first.sigunguName.trim();
  const secondName = second.sigunguName.trim();
  return (
    normalizeSigungu(firstName) === normalizeSigungu(secondName) ||
    firstName.startsWith(`${secondName} `) ||
    secondName.startsWith(`${firstName} `)
  );
}

function hasLocalCoverage(row: AvailabilityRow): boolean {
  return coverageTokens(row).some(
    token => /[읍면동]$/.test(token) || /(?:동지역|읍면지역)$/.test(token),
  );
}

function coversAdministrativeRegion(
  availabilityRow: AvailabilityRow,
  administrativeRow: AdministrativeRegionRow,
): boolean {
  const administrativeName = normalizeCoverageName(
    administrativeRow.eupmyeondongName,
  );
  return coverageTokens(availabilityRow).some(token => {
    const withoutOrdinal = token.replace(/제(?=\d)/g, '');
    const administrativeWithoutOrdinal = administrativeName.replace(
      /제(?=\d)/g,
      '',
    );
    return (
      token === administrativeName ||
      withoutOrdinal === administrativeWithoutOrdinal ||
      (token === '동지역' && administrativeName.endsWith('동')) ||
      (token === '읍면지역' && /[읍면]$/.test(administrativeName))
    );
  });
}

function coverageTokens(row: AvailabilityRow): string[] {
  return [row.managementZoneName, row.targetRegionName]
    .flatMap(value => value.split(/[,+/]/))
    .map(normalizeCoverageName);
}

function normalizeCoverageName(value: string): string {
  return value.replace(/\s/g, '').trim();
}

function normalizeSigungu(value: string): string {
  return value.replace(/시$/, '');
}

function scopeKey(scope: GuideScopeRow): string {
  return `${scope.sidoName}:${normalizeSigungu(scope.sigunguName)}`;
}

function childKey(level: RegionLevel, parentId?: string): string {
  return `${level}:${parentId ?? ''}`;
}

function toGuideScope(row: GuideScopeRow): GuideScopeRow {
  return { sidoName: row.sidoName, sigunguName: row.sigunguName };
}

function uniqueBy<T>(
  values: readonly T[],
  selectKey: (value: T) => string,
): T[] {
  const uniqueValues = new Map<string, T>();
  for (const value of values) uniqueValues.set(selectKey(value), value);
  return [...uniqueValues.values()];
}

function compareBy<T>(
  selectValue: (value: T) => string,
): (first: T, second: T) => number {
  return (first, second) =>
    selectValue(first).localeCompare(selectValue(second), 'ko', {
      numeric: true,
    });
}

function compareScopes(first: GuideScopeRow, second: GuideScopeRow): number {
  return (
    first.sidoName.localeCompare(second.sidoName, 'ko') ||
    first.sigunguName.localeCompare(second.sigunguName, 'ko')
  );
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
