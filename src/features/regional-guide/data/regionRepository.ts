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

type LegalAdminDongMappingRow = GuideScopeRow &
  Readonly<{
    legalCode: string;
    legalDongName: string;
    adminCode: string;
    adminDongName: string;
  }>;

export type RegionCatalog = Readonly<{
  regions: readonly Region[];
  invalidRowCount: number;
  searchAliasesByRegionId: ReadonlyMap<string, readonly string[]>;
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
  const legalAdminDongMappings: unknown = require('./assets/legalToAdminMappings.json');
  regionCatalog = createRegionCatalog(
    guideScopes,
    availability,
    administrativeRegions,
    legalAdminDongMappings,
  );
  return regionCatalog;
}

export function createRegionCatalog(
  rawGuideScopes: unknown,
  rawAvailability: unknown,
  rawAdministrativeRegions: unknown,
  rawLegalAdminDongMappings: unknown = [],
): RegionCatalog {
  const guideScopes = parseRows(rawGuideScopes, readGuideScope);
  const availability = parseRows(rawAvailability, readAvailability);
  const administrativeRegions = parseRows(
    rawAdministrativeRegions,
    readAdministrativeRegion,
  );
  const legalAdminDongMappings = parseRows(
    rawLegalAdminDongMappings,
    readLegalAdminDongMapping,
  );
  const legalDongAliasesByAdminCode = groupLegalDongAliases(
    legalAdminDongMappings.values,
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
  const searchAliasesByRegionId = new Map<string, string[]>();
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
    collectSearchAliases(
      searchAliasesByRegionId,
      availabilityRows,
      administrativeRows,
    );
    collectLegalDongAliases(
      searchAliasesByRegionId,
      legalDongAliasesByAdminCode,
      availabilityRows,
      administrativeRows,
      selectableRows,
    );
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
      administrativeRegions.invalidRowCount +
      legalAdminDongMappings.invalidRowCount,
    searchAliasesByRegionId,
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

function readLegalAdminDongMapping(
  row: Record<string, unknown>,
): LegalAdminDongMappingRow | undefined {
  const legalCode = readString(row.legalCode);
  const legalDongName = readString(row.legalDongName);
  const adminCode = readString(row.adminCode);
  const sidoName = readString(row.sidoName);
  const sigunguName =
    readString(row.sigunguName) ??
    (sidoName === '세종특별자치시' ? '없음' : undefined);
  const adminDongName = readString(row.adminDongName);
  const hasValidCodes =
    legalCode &&
    adminCode &&
    /^\d{10}$/.test(legalCode) &&
    /^\d{10}$/.test(adminCode) &&
    legalCode.slice(0, 5) === adminCode.slice(0, 5);
  return hasValidCodes &&
    legalDongName &&
    sidoName &&
    sigunguName &&
    adminDongName
    ? {
        legalCode,
        legalDongName,
        adminCode,
        sidoName,
        sigunguName,
        adminDongName,
      }
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
  return coverageTokens(availabilityRow).some(token =>
    matchesCoverageToken(token, administrativeRow.eupmyeondongName),
  );
}

function coverageTokens(row: AvailabilityRow): string[] {
  return [row.managementZoneName, row.targetRegionName].flatMap(
    coverageValueTokens,
  );
}

function coverageValueTokens(value: string): string[] {
  return value.split(/[,+/]/).map(normalizeCoverageName);
}

function normalizeCoverageName(value: string): string {
  return value.replace(/\s/g, '').trim();
}

function matchesCoverageToken(
  token: string,
  administrativeName: string,
): boolean {
  const comparableToken = removeOrdinal(normalizeCoverageName(token));
  const comparableAdministrativeName = removeOrdinal(
    normalizeCoverageName(administrativeName),
  );
  if (comparableToken === comparableAdministrativeName) return true;
  if (
    comparableToken === '동지역' &&
    comparableAdministrativeName.endsWith('동')
  ) {
    return true;
  }
  if (
    comparableToken === '읍면지역' &&
    /[읍면]$/.test(comparableAdministrativeName)
  ) {
    return true;
  }

  const range = /^(.+?)(\d+)동?~(\d+)동$/.exec(comparableToken);
  const numberedRegion = /^(.+?)(\d+)동$/.exec(
    comparableAdministrativeName,
  );
  if (!range || !numberedRegion || range[1] !== numberedRegion[1]) {
    return false;
  }

  const first = Number(range[2]);
  const last = Number(range[3]);
  const ordinal = Number(numberedRegion[2]);
  return ordinal >= Math.min(first, last) && ordinal <= Math.max(first, last);
}

function collectSearchAliases(
  aliasesByRegionId: Map<string, string[]>,
  availabilityRows: readonly AvailabilityRow[],
  administrativeRows: readonly AdministrativeRegionRow[],
): void {
  for (const availabilityRow of availabilityRows) {
    const managementRegions = administrativeRows.filter(administrativeRow =>
      coverageValueTokens(availabilityRow.managementZoneName).some(token =>
        matchesCoverageToken(token, administrativeRow.eupmyeondongName),
      ),
    );
    if (managementRegions.length !== 1) continue;

    const aliases = coverageValueTokens(availabilityRow.targetRegionName)
      .filter(isRegionNameToken)
      .filter(
        alias =>
          !administrativeRows.some(administrativeRow =>
            matchesCoverageToken(alias, administrativeRow.eupmyeondongName),
          ),
      );
    if (aliases.length === 0) continue;

    const regionId = `eupmyeondong:${managementRegions[0].adminCode}`;
    const currentAliases = aliasesByRegionId.get(regionId) ?? [];
    aliasesByRegionId.set(
      regionId,
      uniqueStrings([...currentAliases, ...aliases]),
    );
  }
}

function collectLegalDongAliases(
  aliasesByRegionId: Map<string, string[]>,
  legalDongAliasesByAdminCode: ReadonlyMap<string, readonly string[]>,
  availabilityRows: readonly AvailabilityRow[],
  administrativeRows: readonly AdministrativeRegionRow[],
  selectableRows: readonly AdministrativeRegionRow[],
): void {
  const preferredAdminCodesByAlias = collectPreferredAdminCodesByAlias(
    availabilityRows,
    administrativeRows,
  );
  const numberedDongAliases = new Set(
    selectableRows
      .map(row => unnumberedDongAlias(row.eupmyeondongName))
      .filter((name): name is string => Boolean(name)),
  );

  for (const selectableRow of selectableRows) {
    const legalDongAliases = legalDongAliasesByAdminCode.get(
      selectableRow.adminCode,
    );
    if (!legalDongAliases) continue;

    const applicableAliases = legalDongAliases.filter(alias => {
      const comparableAlias = removeOrdinal(normalizeCoverageName(alias));
      if (numberedDongAliases.has(comparableAlias)) return false;

      const preferredAdminCodes = preferredAdminCodesByAlias.get(
        comparableAlias,
      );
      return (
        !preferredAdminCodes || preferredAdminCodes.has(selectableRow.adminCode)
      );
    });
    if (applicableAliases.length === 0) continue;

    const regionId = `eupmyeondong:${selectableRow.adminCode}`;
    const currentAliases = aliasesByRegionId.get(regionId) ?? [];
    aliasesByRegionId.set(
      regionId,
      uniqueStrings([...currentAliases, ...applicableAliases]),
    );
  }
}

function collectPreferredAdminCodesByAlias(
  availabilityRows: readonly AvailabilityRow[],
  administrativeRows: readonly AdministrativeRegionRow[],
): ReadonlyMap<string, ReadonlySet<string>> {
  const adminCodesByAlias = new Map<string, Set<string>>();
  for (const availabilityRow of availabilityRows) {
    const coveredAdminCodes = administrativeRows
      .filter(row => coversAdministrativeRegion(availabilityRow, row))
      .map(row => row.adminCode);
    if (coveredAdminCodes.length === 0) continue;

    for (const alias of coverageValueTokens(availabilityRow.targetRegionName)) {
      if (!isRegionNameToken(alias)) continue;

      const comparableAlias = removeOrdinal(normalizeCoverageName(alias));
      const adminCodes = adminCodesByAlias.get(comparableAlias) ?? new Set();
      coveredAdminCodes.forEach(adminCode => adminCodes.add(adminCode));
      adminCodesByAlias.set(comparableAlias, adminCodes);
    }
  }
  return adminCodesByAlias;
}

function unnumberedDongAlias(value: string): string | undefined {
  const comparableName = removeOrdinal(normalizeCoverageName(value));
  const numberedDong = /^(.+?)\d+동$/.exec(comparableName);
  return numberedDong ? `${numberedDong[1]}동` : undefined;
}

function groupLegalDongAliases(
  mappings: readonly LegalAdminDongMappingRow[],
): ReadonlyMap<string, readonly string[]> {
  const aliasesByAdminCode = new Map<string, string[]>();
  for (const mapping of mappings) {
    const aliases = aliasesByAdminCode.get(mapping.adminCode) ?? [];
    aliasesByAdminCode.set(
      mapping.adminCode,
      uniqueStrings([...aliases, mapping.legalDongName]),
    );
  }
  return aliasesByAdminCode;
}

function isRegionNameToken(value: string): boolean {
  return /^[가-힣0-9.]+[읍면동]$/.test(value);
}

function removeOrdinal(value: string): string {
  return value.replace(/제(?=\d)/g, '');
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

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
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
