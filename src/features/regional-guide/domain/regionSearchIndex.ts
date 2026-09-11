import type { Region, RegionSelection } from './Region';
import type {
  RegionSearchCandidate,
  RegionSearchInputType,
  RegionSearchResult,
} from './RegionSearch';
import {
  isSidoName,
  normalizeRegionName,
  normalizeSidoName,
} from './regionNormalization';

const ADDRESS_NUMBER = /^\d+(?:-\d+)?$/;
const ROAD_NAME = /(?:로|길)\d*$/;
const SIGUNGU_SUFFIX = /[시군구]$/;
const EUPMYEONDONG_SUFFIX = /[읍면동]$/;
const NUMBERED_DONG = /^(.+?)(?:제)?\d+동$/;

type ParsedQuery = Readonly<{
  sidoName?: string;
  sigunguName?: string;
  eupmyeondongName?: string;
  keyword?: string;
}>;

type IndexedCandidate = Readonly<{
  candidate: RegionSearchCandidate;
  canonicalSidoName?: string;
  sidoName?: string;
  sigunguName?: string;
  eupmyeondongName?: string;
  unnumberedDongName?: string;
}>;

export type RegionSearchIndex = Readonly<{
  candidateCount: number;
  exactKeyCount: number;
  candidates: readonly IndexedCandidate[];
  candidatesByExactKey: ReadonlyMap<string, readonly IndexedCandidate[]>;
}>;

export function classifyRegionSearchInput(
  input: string,
): RegionSearchInputType {
  const tokens = tokenize(input);
  if (tokens.length === 0) return 'empty';

  const hasSido = tokens.some(isSidoName);
  const hasSigungu = tokens.some(token => SIGUNGU_SUFFIX.test(token));
  const hasCompoundSigungu = tokens.some(
    (token, index) => token.endsWith('시') && tokens[index + 1]?.endsWith('구'),
  );
  const hasAddressDetail = tokens.some(
    token => ADDRESS_NUMBER.test(token) || ROAD_NAME.test(token),
  );
  return hasAddressDetail && ((hasSido && hasSigungu) || hasCompoundSigungu)
    ? 'address'
    : 'region-keyword';
}

export function createRegionSearchIndex(
  regions: readonly Region[],
): RegionSearchIndex {
  const candidates = createCandidates(regions).map(indexCandidate);
  const candidatesByExactKey = new Map<string, IndexedCandidate[]>();

  for (const indexedCandidate of candidates) {
    for (const key of exactKeys(indexedCandidate)) {
      const matchingCandidates = candidatesByExactKey.get(key) ?? [];
      if (
        !matchingCandidates.some(
          item => item.candidate.id === indexedCandidate.candidate.id,
        )
      ) {
        matchingCandidates.push(indexedCandidate);
        candidatesByExactKey.set(key, matchingCandidates);
      }
    }
  }

  return {
    candidateCount: candidates.length,
    exactKeyCount: candidatesByExactKey.size,
    candidates,
    candidatesByExactKey,
  };
}

export function searchRegionIndex(
  index: RegionSearchIndex,
  rawQuery: string,
): RegionSearchResult {
  if (classifyRegionSearchInput(rawQuery) === 'empty') {
    return { status: 'not-found' };
  }

  const query = parseQuery(rawQuery);
  if (!isMeaningful(query)) return { status: 'not-found' };

  const exactKey = selectExactKey(query);
  const searchPool = exactKey
    ? (index.candidatesByExactKey.get(exactKey) ?? index.candidates)
    : index.candidates;
  const matches = searchPool.filter(candidate => matchesQuery(candidate, query));
  const candidates = selectBestMatches(matches, query);

  if (candidates.length === 0) return { status: 'not-found' };
  if (candidates.length === 1) {
    return { status: 'resolved', candidate: candidates[0] };
  }
  return { status: 'candidates', candidates };
}

function createCandidates(regions: readonly Region[]): RegionSearchCandidate[] {
  const regionById = new Map(regions.map(region => [region.id, region]));
  const candidates: RegionSearchCandidate[] = [];

  for (const region of regions) {
    if (region.level === 'sigungu') {
      const sido = region.parentId ? regionById.get(region.parentId) : undefined;
      if (sido?.level === 'sido') {
        candidates.push(toCandidate({ sido, sigungu: region }));
      }
      continue;
    }
    if (region.level !== 'eupmyeondong') continue;

    const sigungu = region.parentId ? regionById.get(region.parentId) : undefined;
    const sido = sigungu?.parentId
      ? regionById.get(sigungu.parentId)
      : undefined;
    if (sido?.level === 'sido' && sigungu?.level === 'sigungu') {
      candidates.push(
        toCandidate({ sido, sigungu, eupmyeondong: region }),
      );
    }
  }
  return candidates;
}

function toCandidate(selection: RegionSelection): RegionSearchCandidate {
  const canonicalSidoName = normalizeSidoName(
    selection.sido?.name,
    selection.sigungu?.name,
  );
  const canonicalSelection: RegionSelection = {
    ...selection,
    sido:
      selection.sido && canonicalSidoName
        ? { ...selection.sido, name: canonicalSidoName }
        : selection.sido,
  };
  const path = [
    canonicalSelection.sido,
    canonicalSelection.sigungu,
    canonicalSelection.eupmyeondong,
  ].filter((region): region is Region => Boolean(region));

  return {
    id: path.map(region => region.id).join('|'),
    displayName: path
      .filter(region => region.name !== '없음')
      .map(region => region.name)
      .join(' '),
    region: canonicalSelection,
  };
}

function indexCandidate(candidate: RegionSearchCandidate): IndexedCandidate {
  const { sido, sigungu, eupmyeondong } = candidate.region;
  const eupmyeondongName = eupmyeondong
    ? normalizeRegionName(eupmyeondong.name)
    : undefined;
  const numberedDong = eupmyeondongName
    ? NUMBERED_DONG.exec(eupmyeondongName)
    : undefined;
  return {
    candidate,
    canonicalSidoName: normalizeSidoName(sido?.name, sigungu?.name),
    sidoName: sido ? normalizeRegionName(sido.name) : undefined,
    sigunguName: sigungu ? normalizeRegionName(sigungu.name) : undefined,
    eupmyeondongName,
    unnumberedDongName: numberedDong ? `${numberedDong[1]}동` : undefined,
  };
}

function exactKeys(candidate: IndexedCandidate): string[] {
  return uniqueStrings([
    candidate.canonicalSidoName,
    candidate.sidoName,
    candidate.sigunguName,
    candidate.eupmyeondongName,
    candidate.unnumberedDongName,
  ]);
}

function parseQuery(input: string): ParsedQuery {
  const tokens = tokenize(input);
  const consumed = new Set<number>();
  const sidoIndex = tokens.findIndex(isSidoName);
  let sidoName: string | undefined;
  if (sidoIndex >= 0) {
    sidoName = normalizeSidoName(tokens[sidoIndex]);
    consumed.add(sidoIndex);
  }

  let sigunguName: string | undefined;
  for (let index = 0; index < tokens.length; index += 1) {
    if (consumed.has(index)) continue;
    const token = tokens[index];
    const nextToken = tokens[index + 1];
    if (token.endsWith('시') && nextToken?.endsWith('구')) {
      sigunguName = `${token} ${nextToken}`;
      consumed.add(index);
      consumed.add(index + 1);
      break;
    }
    if (SIGUNGU_SUFFIX.test(token)) {
      sigunguName = token;
      consumed.add(index);
      break;
    }
  }

  const eupmyeondongIndex = tokens.findIndex(
    (token, index) =>
      !consumed.has(index) && EUPMYEONDONG_SUFFIX.test(token),
  );
  const eupmyeondongName =
    eupmyeondongIndex >= 0 ? tokens[eupmyeondongIndex] : undefined;
  if (eupmyeondongIndex >= 0) consumed.add(eupmyeondongIndex);

  if (sidoName === '전남광주통합특별시') {
    sidoName = normalizeSidoName(sidoName, sigunguName);
  }

  const keyword = tokens.find(
    (token, index) =>
      !consumed.has(index) &&
      !ADDRESS_NUMBER.test(token) &&
      !ROAD_NAME.test(token),
  );
  return { sidoName, sigunguName, eupmyeondongName, keyword };
}

function matchesQuery(candidate: IndexedCandidate, query: ParsedQuery): boolean {
  if (
    query.sidoName &&
    candidate.canonicalSidoName !== normalizeSidoName(query.sidoName)
  ) {
    return false;
  }

  if (query.sigunguName) {
    if (!matchesSigungu(candidate.sigunguName, query.sigunguName)) return false;
    if (!query.eupmyeondongName) {
      return candidate.candidate.region.eupmyeondong === undefined;
    }
  }

  if (query.eupmyeondongName) {
    return matchesEupmyeondong(candidate, query.eupmyeondongName);
  }
  if (query.keyword) return includesKeyword(candidate, query.keyword);
  return candidate.candidate.region.eupmyeondong === undefined;
}

function matchesSigungu(
  candidateName: string | undefined,
  queryName: string,
): boolean {
  if (!candidateName) return false;
  const query = normalizeRegionName(queryName);
  return (
    candidateName === query ||
    candidateName.replace(/시$/, '') === query.replace(/시$/, '') ||
    (candidateName.endsWith('시') && query.startsWith(candidateName)) ||
    (query.endsWith('시') && candidateName.startsWith(query))
  );
}

function matchesEupmyeondong(
  candidate: IndexedCandidate,
  queryName: string,
): boolean {
  const name = candidate.eupmyeondongName;
  if (!name) return false;
  const query = normalizeRegionName(queryName);
  return (
    name === query ||
    name.startsWith(query) ||
    candidate.unnumberedDongName === query
  );
}

function includesKeyword(candidate: IndexedCandidate, keyword: string): boolean {
  const normalizedKeyword = normalizeRegionName(keyword);
  return (
    comparableNames(candidate).some(name => name.includes(normalizedKeyword)) ||
    candidate.unnumberedDongName === normalizedKeyword
  );
}

function selectBestMatches(
  candidates: readonly IndexedCandidate[],
  query: ParsedQuery,
): RegionSearchCandidate[] {
  const keyword = query.eupmyeondongName ?? query.keyword;
  const ranked = candidates.map(candidate => ({
    candidate,
    score: keyword ? matchScore(candidate, keyword) : 0,
  }));
  const bestScore = ranked.reduce(
    (minimum, item) => Math.min(minimum, item.score),
    Number.POSITIVE_INFINITY,
  );
  const uniqueCandidates = new Map<string, RegionSearchCandidate>();
  for (const item of ranked) {
    if (item.score === bestScore) {
      uniqueCandidates.set(item.candidate.candidate.id, item.candidate.candidate);
    }
  }
  return [...uniqueCandidates.values()].sort((first, second) =>
    first.displayName.localeCompare(second.displayName, 'ko', {
      numeric: true,
    }),
  );
}

function matchScore(candidate: IndexedCandidate, keyword: string): number {
  const query = normalizeRegionName(keyword);
  const names = comparableNames(candidate);
  if (names.includes(query)) return 0;
  if (candidate.unnumberedDongName === query) return 1;
  if (names.some(name => name.startsWith(query))) return 2;
  return 3;
}

function comparableNames(candidate: IndexedCandidate): string[] {
  return uniqueStrings([
    candidate.sidoName,
    candidate.sigunguName,
    candidate.eupmyeondongName,
  ]);
}

function selectExactKey(query: ParsedQuery): string | undefined {
  const key =
    query.eupmyeondongName ?? query.keyword ?? query.sigunguName ?? query.sidoName;
  return key ? normalizeRegionName(key) : undefined;
}

function isMeaningful(query: ParsedQuery): boolean {
  if (query.sidoName) return true;
  return [query.sigunguName, query.eupmyeondongName, query.keyword].some(
    value => Boolean(value && normalizeRegionName(value).length >= 2),
  );
}

function tokenize(input: string): string[] {
  return input
    .normalize('NFC')
    .replace(/[()[\]]/g, ' ')
    .trim()
    .split(/\s+/)
    .map(token => token.replace(/^[,.\[\]()]+|[,.\[\]()]+$/g, ''))
    .filter(Boolean);
}

function uniqueStrings(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
