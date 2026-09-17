import type {
  RegionalDisposalGuide,
  RegionalWasteSchedule,
} from './RegionalDisposalGuide';
import type { RegionalGuideQuery } from './regionalGuideQuery';
import { normalizeSidoName } from './regionNormalization';

export type RegionalGuideCandidateReason =
  | 'multiple-exact-matches'
  | 'multiple-candidates'
  | 'fallback-because-direct-match-not-found';

export type RegionalGuideCandidateSelection =
  | Readonly<{ status: 'selected'; guide: RegionalDisposalGuide }>
  | Readonly<{
      status: 'candidates';
      guides: readonly RegionalDisposalGuide[];
      reason: RegionalGuideCandidateReason;
    }>
  | Readonly<{ status: 'not-provided' }>;

export function selectRegionalGuideCandidate(
  guides: readonly RegionalDisposalGuide[],
  query: RegionalGuideQuery,
): RegionalGuideCandidateSelection {
  const candidates = mergeDuplicateCandidateRowsByLatestDate(guides).filter(
    guide => matchesQueryScope(guide, query),
  );
  if (candidates.length === 0) return { status: 'not-provided' };

  const eupmyeondongName = normalizeText(query.eupmyeondongName);
  if (!eupmyeondongName) {
    return toSelection(candidates, 'multiple-candidates');
  }

  const exactMatches = candidates.filter(guide =>
    [guide.managementZoneName, guide.targetRegionName].some(regionName =>
      matchesRequestedRegion(
        regionName,
        eupmyeondongName,
        query.eupmyeondongAliases,
      ),
    ),
  );
  if (exactMatches.length > 0) {
    return toSelection(exactMatches, 'multiple-exact-matches');
  }

  const areaMatches = candidates.filter(guide =>
    [guide.managementZoneName, guide.targetRegionName].some(regionName =>
      matchesArea(regionName, eupmyeondongName),
    ),
  );
  if (areaMatches.length > 0) {
    return toSelection(
      areaMatches,
      'fallback-because-direct-match-not-found',
    );
  }

  const overallMatches = candidates.filter(guide =>
    isOverallTarget(guide.targetRegionName, query.sigunguName),
  );
  if (overallMatches.length > 0) {
    return toSelection(
      overallMatches,
      'fallback-because-direct-match-not-found',
    );
  }

  const fallbackMatches = candidates.filter(
    guide =>
      !hasExplicitEupmyeondongTarget(guide) &&
      matchesRequestedBroadArea(guide, eupmyeondongName),
  );
  if (fallbackMatches.length > 0) {
    return toSelection(
      fallbackMatches,
      'fallback-because-direct-match-not-found',
    );
  }

  return { status: 'not-provided' };
}

function matchesQueryScope(
  guide: RegionalDisposalGuide,
  query: RegionalGuideQuery,
): boolean {
  const requestedSido = normalizeSidoName(query.sidoName, query.sigunguName);
  const candidateSido = normalizeSidoName(guide.sidoName, guide.sigunguName);
  if (requestedSido && candidateSido && requestedSido !== candidateSido) {
    return false;
  }

  const requestedSigungu = normalizeComparableName(query.sigunguName);
  const candidateSigungu = normalizeComparableName(guide.sigunguName ?? '');
  return (
    requestedSigungu === '없음' ||
    !candidateSigungu ||
    candidateSigungu === requestedSigungu
  );
}

export function mergeDuplicateCandidateRowsByLatestDate(
  guides: readonly RegionalDisposalGuide[],
): readonly RegionalDisposalGuide[] {
  const groups = groupBy(guides, latestCandidateKey);
  return [...groups.values()].flatMap(group => selectLatestRows(group));
}

function toSelection(
  guides: readonly RegionalDisposalGuide[],
  reason: RegionalGuideCandidateReason,
): RegionalGuideCandidateSelection {
  return guides.length === 1
    ? { status: 'selected', guide: guides[0] }
    : { status: 'candidates', guides, reason };
}

function matchesRequestedRegion(
  providedRegionName: string | undefined,
  requestedRegionName: string,
  requestedAliases: readonly string[] = [],
): boolean {
  return [requestedRegionName, ...requestedAliases].some(requestedName =>
    matchesSingleRequestedRegion(providedRegionName, requestedName),
  );
}

function matchesSingleRequestedRegion(
  providedRegionName: string | undefined,
  requestedRegionName: string,
): boolean {
  const provided = normalizeText(providedRegionName);
  if (!provided || isAreaExpression(provided)) return false;

  const requested = normalizeComparableName(requestedRegionName);
  const providedComparable = normalizeComparableName(provided);
  if (
    providedComparable === requested ||
    providedComparable.includes(requested)
  ) {
    return true;
  }

  const requestedNames = expandAdministrativeNames(requestedRegionName);
  const providedNames = expandAdministrativeNames(provided);
  if (providedNames.some(name => requestedNames.includes(name))) return true;

  const requestedWithoutSuffix = removeAdministrativeSuffix(requested);
  if (
    providedNames.some(
      name => removeAdministrativeSuffix(name) === requestedWithoutSuffix,
    )
  ) {
    return true;
  }

  const broadDongName = requested.replace(/\d+(?:[.·ㆍ]\d+)?동$/, '동');
  if (
    broadDongName !== requested &&
    providedNames.some(name => name === broadDongName)
  ) {
    return true;
  }

  const branchParent = /^(.+?[읍면동]).+출장소$/.exec(requested)?.[1];
  return Boolean(branchParent && providedNames.includes(branchParent));
}

function hasExplicitEupmyeondongTarget(
  guide: RegionalDisposalGuide,
): boolean {
  return [guide.managementZoneName, guide.targetRegionName].some(value =>
    explicitRegionTokens(value).some(token =>
      /[읍면동]$/.test(token.replace(/제(?=\d)/g, '')),
    ),
  );
}

function explicitRegionTokens(value: string | undefined): string[] {
  return (
    value
      ?.replace(/\([^)]*\)|（[^）]*）/g, '')
      .replace(/\s+/g, '')
      .split(/[,+/]/)
      .map(token => token.trim())
      .filter(Boolean) ?? []
  );
}

function matchesRequestedBroadArea(
  guide: RegionalDisposalGuide,
  requestedRegionName: string,
): boolean {
  const values = [guide.managementZoneName, guide.targetRegionName];
  const hasDongArea = values.some(value => areaExpression(value) === 'dong');
  const hasEupmyeonArea = values.some(
    value => areaExpression(value) === 'eupmyeon',
  );
  const mentionsArea = values.some(value => {
    const compact = value?.replace(/\s+/g, '') ?? '';
    return compact.includes('동지역') || compact.includes('읍면지역');
  });
  const requested = normalizeComparableName(requestedRegionName);

  if (hasDongArea) return requested.endsWith('동');
  if (hasEupmyeonArea) return /[읍면]$/.test(requested);
  return !mentionsArea;
}

function expandAdministrativeNames(value: string): string[] {
  const normalized = normalizeComparableName(
    value.replace(/\([^)]*\)|（[^）]*）/g, ''),
  );
  const values = normalized
    .split(/[+/]/)
    .flatMap(splitAdministrativeSegments)
    .flatMap(expandAdministrativeToken);
  return [...new Set(values.filter(Boolean))];
}

function splitAdministrativeSegments(value: string): string[] {
  // 쉼표는 `부곡1,4동`처럼 번호를 묶는 기호이면서
  // `괴정1~3동,하단1~2동`처럼 서로 다른 지역을 나누는 기호이기도 하다.
  // 쉼표 뒤가 숫자가 아닐 때만 독립 지역으로 분리해 두 표기를 모두 보존한다.
  return value.split(/,(?=[^\d])/);
}

function expandAdministrativeToken(value: string): string[] {
  const range = /^([^\d,+/~～-]+?)(\d+)[~～-](\d+)([읍면동])$/.exec(value);
  if (range) {
    const start = Number(range[2]);
    const end = Number(range[3]);
    if (start <= end && end - start <= 20) {
      return Array.from(
        { length: end - start + 1 },
        (_, index) => `${range[1]}${start + index}${range[4]}`,
      );
    }
  }

  const group = /^([^\d,+/~～-]+?)(\d+(?:,\d+)+)([읍면동])$/.exec(value);
  if (group) {
    return group[2]
      .split(',')
      .map(number => `${group[1]}${Number(number)}${group[3]}`);
  }

  return value
    .split(/[,·ㆍ.]/)
    .map(token =>
      token
        .replace(/(?:일부지역|일부|일원|전지역|전체)$/g, '')
        .trim(),
    );
}

function matchesArea(
  providedRegionName: string | undefined,
  requestedRegionName: string,
): boolean {
  const area = areaExpression(providedRegionName);
  if (area === 'dong') return normalizeComparableName(requestedRegionName).endsWith('동');
  if (area === 'eupmyeon') return /[읍면]$/.test(normalizeComparableName(requestedRegionName));
  return false;
}

function isAreaExpression(value: string): boolean {
  return areaExpression(value) !== undefined;
}

function areaExpression(value: string | undefined): 'dong' | 'eupmyeon' | undefined {
  const tokens = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  const compact = tokens.join('');
  const last = tokens.at(-1);
  if (compact === '동지역' || last === '동지역') return 'dong';
  if (compact === '읍면지역' || last === '읍면지역') return 'eupmyeon';
  return undefined;
}

function isOverallTarget(
  targetRegionName: string | undefined,
  sigunguName: string,
): boolean {
  const target = normalizeComparableName(targetRegionName ?? '');
  if (!target || target === '없음') return true;
  if (target === normalizeComparableName(sigunguName)) return true;
  return ['전체', '전역', '관내'].some(keyword => target.includes(keyword));
}

function selectLatestRows(
  guides: readonly RegionalDisposalGuide[],
): RegionalDisposalGuide[] {
  if (guides.length <= 1) return [...guides];

  const latestRows = selectRowsAtLatestPoint(guides);
  if (latestRows) return distinctBy(latestRows, contentCandidateKey);

  return [...groupBy(guides, legacyCandidateKey).values()].map(mergeSchedules);
}

function selectRowsAtLatestPoint(
  guides: readonly RegionalDisposalGuide[],
): readonly RegionalDisposalGuide[] | undefined {
  const hasLastModifiedPoint = guides.some(
    guide => normalizeText(guide.sourceMetadata?.lastModifiedPoint) !== undefined,
  );
  const points = guides.map(guide =>
    comparableDatePoint(
      hasLastModifiedPoint
        ? guide.sourceMetadata?.lastModifiedPoint
        : guide.sourceMetadata?.dataCriteriaDate,
    ),
  );
  if (points.some(point => point === undefined)) return undefined;

  const latestPoint = Math.max(...(points as number[]));
  return guides.filter((_, index) => points[index] === latestPoint);
}

function comparableDatePoint(value: string | undefined): number | undefined {
  const digits = normalizeText(value)?.replace(/\D/g, '');
  if (!digits || ![8, 14].includes(digits.length)) return undefined;

  const dateTime = digits.padEnd(14, '0');
  const year = Number(dateTime.slice(0, 4));
  const month = Number(dateTime.slice(4, 6));
  const day = Number(dateTime.slice(6, 8));
  const hour = Number(dateTime.slice(8, 10));
  const minute = Number(dateTime.slice(10, 12));
  const second = Number(dateTime.slice(12, 14));
  if (year <= 0) return undefined;

  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    return undefined;
  }
  return date.getTime();
}

function mergeSchedules(
  guides: readonly RegionalDisposalGuide[],
): RegionalDisposalGuide {
  return {
    ...guides[0],
    schedules: distinctBy(
      guides.flatMap(guide => guide.schedules),
      scheduleKey,
    ),
  };
}

function latestCandidateKey(guide: RegionalDisposalGuide): string {
  return keyOf([
    guide.sidoName,
    guide.sigunguName,
    guide.managementZoneName,
    guide.targetRegionName,
    guide.disposalPlaceType,
  ]);
}

function legacyCandidateKey(guide: RegionalDisposalGuide): string {
  return keyOf([
    guide.sidoName,
    guide.sigunguName,
    guide.managementZoneName,
    guide.targetRegionName,
    guide.disposalPlaceType,
    guide.disposalPlace,
    guide.uncollectedDays,
    guide.departmentName,
    guide.departmentPhoneNumber,
  ]);
}

function contentCandidateKey(guide: RegionalDisposalGuide): string {
  return `${legacyCandidateKey(guide)}|${keyOf(
    guide.schedules.map(scheduleKey),
  )}`;
}

function scheduleKey(schedule: RegionalWasteSchedule): string {
  return keyOf([
    schedule.wasteType,
    schedule.disposalDays,
    schedule.disposalStartTime,
    schedule.disposalEndTime,
    schedule.disposalMethod,
    schedule.disposalPlace,
  ]);
}

function keyOf(values: readonly (string | undefined)[]): string {
  return values
    .map(value => {
      const normalized = normalizeText(value) ?? '';
      return `${normalized.length}:${normalized}`;
    })
    .join('|');
}

function groupBy<T>(
  values: readonly T[],
  keySelector: (value: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keySelector(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}

function distinctBy<T>(
  values: readonly T[],
  keySelector: (value: T) => string,
): T[] {
  return [...new Map(values.map(value => [keySelector(value), value])).values()];
}

function normalizeComparableName(value: string): string {
  return value
    .normalize('NFC')
    .replace(/\s+/g, '')
    .replace(/제(?=\d)/g, '')
    .trim();
}

function removeAdministrativeSuffix(value: string): string {
  return value.replace(/[읍면동]$/, '');
}

function normalizeText(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}
