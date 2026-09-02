import type { Region, SelectedRegion } from "./Region";
import type {
  RegionSearchCandidate,
  RegionSearchInputType,
  RegionSearchResult,
} from "./RegionSearchModel";
import {
  isSidoName,
  normalizeComparableRegionName,
  normalizeSidoName,
} from "./regionNormalization";

const WHITESPACE = /\s+/;
const ADDRESS_NUMBER = /^\d+(?:-\d+)?$/;
const ROAD_NAME = /(?:로|길)\d*$/;
const REGION_SUFFIX = /[시군구]$/;
const EUPMYEONDONG_SUFFIX = /[읍면동]$/;
const NUMBERED_DONG = /^(.+?)(?:제)?\d+동$/;

interface ParsedSearchQuery {
  sidoName?: string;
  sigunguName?: string;
  eupmyeondongName?: string;
  remainingKeyword?: string;
}

interface IndexedRegionSearchCandidate {
  candidate: RegionSearchCandidate;
  canonicalSidoName?: string;
  comparableSidoName?: string;
  comparableSigunguName?: string;
  comparableEupmyeondongName?: string;
  numberedDongAlias?: string;
}

export interface RegionSearchIndex {
  readonly candidateCount: number;
  readonly lookupKeyCount: number;
  readonly candidates: readonly IndexedRegionSearchCandidate[];
  readonly candidatesByExactKey: ReadonlyMap<
    string,
    readonly IndexedRegionSearchCandidate[]
  >;
}

export function classifyRegionSearchInput(
  input: string,
): RegionSearchInputType {
  const tokens = tokenize(input);
  if (tokens.length === 0) return "empty";

  const hasSido = tokens.some(isSidoName);
  const sigunguCount = tokens.filter((token) =>
    REGION_SUFFIX.test(token),
  ).length;
  const hasCompoundSigungu = tokens.some(
    (token, index) => token.endsWith("시") && tokens[index + 1]?.endsWith("구"),
  );
  const hasAddressDetail = tokens.some(
    (token) => ADDRESS_NUMBER.test(token) || ROAD_NAME.test(token),
  );

  return (hasSido && sigunguCount > 0) || hasCompoundSigungu
    ? hasAddressDetail
      ? "address"
      : "region-keyword"
    : "region-keyword";
}

/** 검색마다 후보와 정규화 문자열을 다시 만드는 비교 기준 구현입니다. */
export function searchAvailableRegions(
  regions: readonly Region[],
  query: string,
): RegionSearchResult {
  return searchRegionIndex(createRegionSearchIndex(regions), query);
}

export function createRegionSearchIndex(
  regions: readonly Region[],
): RegionSearchIndex {
  const indexedCandidates = createCandidates(regions).map(indexCandidate);
  const candidatesByExactKey = new Map<
    string,
    IndexedRegionSearchCandidate[]
  >();

  for (const indexedCandidate of indexedCandidates) {
    for (const key of candidateLookupKeys(indexedCandidate)) {
      const candidates = candidatesByExactKey.get(key) ?? [];
      if (
        !candidates.some(
          ({ candidate }) => candidate.id === indexedCandidate.candidate.id,
        )
      ) {
        candidates.push(indexedCandidate);
        candidatesByExactKey.set(key, candidates);
      }
    }
  }

  return {
    candidateCount: indexedCandidates.length,
    lookupKeyCount: candidatesByExactKey.size,
    candidates: indexedCandidates,
    candidatesByExactKey,
  };
}

/** 측정 패널에서만 호출하며 실제 인덱스 생성 시간에는 포함하지 않습니다. */
export function estimateRegionSearchIndexStringBytes(
  index: RegionSearchIndex,
): number {
  return estimateIndexStringBytes(
    index.candidates,
    index.candidatesByExactKey.keys(),
  );
}

export function searchRegionIndex(
  index: RegionSearchIndex,
  query: string,
): RegionSearchResult {
  if (classifyRegionSearchInput(query) === "empty") {
    return { status: "not-found" };
  }

  const parsedQuery = parseSearchQuery(query);
  if (!hasMeaningfulSearchCriteria(parsedQuery)) {
    return { status: "not-found" };
  }

  const exactKey = exactLookupKey(parsedQuery);
  const searchableCandidates = exactKey
    ? (index.candidatesByExactKey.get(exactKey) ?? index.candidates)
    : index.candidates;
  const candidates = searchableCandidates.filter((candidate) =>
    matchesParsedQuery(candidate, parsedQuery),
  );
  const rankedCandidates = rankCandidates(candidates, parsedQuery);

  if (rankedCandidates.length === 0) return { status: "not-found" };
  if (rankedCandidates.length === 1) {
    return { status: "resolved", candidate: rankedCandidates[0] };
  }
  return { status: "candidates", candidates: rankedCandidates };
}

export function createRegionSearchCandidate(
  region: SelectedRegion,
): RegionSearchCandidate {
  const canonicalSidoName = normalizeSidoName(
    region.sido?.name,
    region.sigungu?.name,
  );
  const canonicalRegion: SelectedRegion = {
    ...region,
    sido:
      region.sido && canonicalSidoName
        ? { ...region.sido, name: canonicalSidoName }
        : region.sido,
  };
  const path = [
    canonicalRegion.sido,
    canonicalRegion.sigungu,
    canonicalRegion.eupmyeondong,
  ].filter((item): item is Region => Boolean(item));
  const displayPath = path.filter((item) => item.name !== "없음");

  return {
    id: path.map((item) => item.id).join("|"),
    region: canonicalRegion,
    displayName: displayPath.map((item) => item.name).join(" "),
  };
}

function createCandidates(regions: readonly Region[]): RegionSearchCandidate[] {
  const regionsById = new Map(regions.map((region) => [region.id, region]));
  const candidates: RegionSearchCandidate[] = [];

  for (const region of regions) {
    if (region.level === "sigungu") {
      const sido = region.parentId
        ? regionsById.get(region.parentId)
        : undefined;
      if (sido)
        candidates.push(createRegionSearchCandidate({ sido, sigungu: region }));
    }
    if (region.level === "eupmyeondong") {
      const sigungu = region.parentId
        ? regionsById.get(region.parentId)
        : undefined;
      const sido = sigungu?.parentId
        ? regionsById.get(sigungu.parentId)
        : undefined;
      if (sido && sigungu) {
        candidates.push(
          createRegionSearchCandidate({ sido, sigungu, eupmyeondong: region }),
        );
      }
    }
  }

  return candidates;
}

function indexCandidate(
  candidate: RegionSearchCandidate,
): IndexedRegionSearchCandidate {
  const { sido, sigungu, eupmyeondong } = candidate.region;
  const comparableEupmyeondongName = eupmyeondong
    ? normalizeComparableRegionName(eupmyeondong.name)
    : undefined;
  const numberedDongMatch = comparableEupmyeondongName
    ? NUMBERED_DONG.exec(comparableEupmyeondongName)
    : undefined;

  return {
    candidate,
    canonicalSidoName: normalizeSidoName(sido?.name, sigungu?.name),
    comparableSidoName: sido
      ? normalizeComparableRegionName(sido.name)
      : undefined,
    comparableSigunguName: sigungu
      ? normalizeComparableRegionName(sigungu.name)
      : undefined,
    comparableEupmyeondongName,
    numberedDongAlias: numberedDongMatch
      ? `${numberedDongMatch[1]}동`
      : undefined,
  };
}

function candidateLookupKeys(
  candidate: IndexedRegionSearchCandidate,
): string[] {
  return [
    candidate.canonicalSidoName,
    candidate.comparableSidoName,
    candidate.comparableSigunguName,
    candidate.comparableEupmyeondongName,
    candidate.numberedDongAlias,
  ].filter((key): key is string => Boolean(key));
}

function exactLookupKey(query: ParsedSearchQuery): string | undefined {
  const key =
    query.eupmyeondongName ??
    query.remainingKeyword ??
    query.sigunguName ??
    query.sidoName;
  return key ? normalizeComparableRegionName(key) : undefined;
}

function parseSearchQuery(query: string): ParsedSearchQuery {
  const tokens = tokenize(query);
  const consumedIndexes = new Set<number>();
  const sidoIndex = tokens.findIndex(isSidoName);
  let sidoName: string | undefined;
  if (sidoIndex >= 0) {
    sidoName = normalizeSidoName(tokens[sidoIndex]);
    consumedIndexes.add(sidoIndex);
  }

  let sigunguName: string | undefined;
  for (let index = 0; index < tokens.length; index += 1) {
    if (consumedIndexes.has(index)) continue;
    const token = tokens[index];
    const nextToken = tokens[index + 1];
    if (token.endsWith("시") && nextToken?.endsWith("구")) {
      sigunguName = `${token} ${nextToken}`;
      consumedIndexes.add(index);
      consumedIndexes.add(index + 1);
      break;
    }
    if (REGION_SUFFIX.test(token)) {
      sigunguName = token;
      consumedIndexes.add(index);
      break;
    }
  }

  const eupmyeondongIndex = tokens.findIndex(
    (token, index) =>
      !consumedIndexes.has(index) && EUPMYEONDONG_SUFFIX.test(token),
  );
  const eupmyeondongName =
    eupmyeondongIndex >= 0 ? tokens[eupmyeondongIndex] : undefined;
  if (eupmyeondongIndex >= 0) consumedIndexes.add(eupmyeondongIndex);

  if (sidoName === "전남광주통합특별시") {
    sidoName = normalizeSidoName(sidoName, sigunguName);
  }

  const remainingKeyword = tokens.find(
    (token, index) =>
      !consumedIndexes.has(index) &&
      !ADDRESS_NUMBER.test(token) &&
      !ROAD_NAME.test(token),
  );

  return { sidoName, sigunguName, eupmyeondongName, remainingKeyword };
}

function hasMeaningfulSearchCriteria(query: ParsedSearchQuery): boolean {
  return Boolean(
    query.sidoName ||
      isMeaningfulRegionName(query.sigunguName) ||
      isMeaningfulRegionName(query.eupmyeondongName) ||
      isMeaningfulRegionName(query.remainingKeyword),
  );
}

function isMeaningfulRegionName(name: string | undefined): boolean {
  return Boolean(name && normalizeComparableRegionName(name).length >= 2);
}

function matchesParsedQuery(
  indexedCandidate: IndexedRegionSearchCandidate,
  query: ParsedSearchQuery,
): boolean {
  const { candidate, canonicalSidoName } = indexedCandidate;
  const { sido, sigungu, eupmyeondong } = candidate.region;
  if (!sido || !sigungu) return false;

  if (query.sidoName && canonicalSidoName !== query.sidoName) return false;

  if (query.sigunguName) {
    if (!sameSigunguName(indexedCandidate, query.sigunguName)) return false;
    if (!query.eupmyeondongName) return eupmyeondong === undefined;
  }

  if (query.eupmyeondongName) {
    return (
      eupmyeondong !== undefined &&
      matchesEupmyeondongName(indexedCandidate, query.eupmyeondongName)
    );
  }

  if (query.remainingKeyword) {
    return matchesRegionKeyword(indexedCandidate, query.remainingKeyword);
  }

  return eupmyeondong === undefined;
}

function rankCandidates(
  candidates: readonly IndexedRegionSearchCandidate[],
  query: ParsedSearchQuery,
): RegionSearchCandidate[] {
  const keyword = query.eupmyeondongName ?? query.remainingKeyword;
  const scored = candidates.map((candidate) => ({
    candidate,
    score: keyword ? matchScore(candidate, keyword) : 0,
  }));
  const bestScore = Math.min(...scored.map(({ score }) => score));

  return scored
    .filter(({ score }) => score === bestScore)
    .map(({ candidate }) => candidate.candidate)
    .filter(
      (candidate, index, all) =>
        all.findIndex((item) => item.id === candidate.id) === index,
    )
    .sort((first, second) =>
      first.displayName.localeCompare(second.displayName, "ko", {
        numeric: true,
      }),
    );
}

function matchScore(
  candidate: IndexedRegionSearchCandidate,
  keyword: string,
): number {
  const comparableKeyword = normalizeComparableRegionName(keyword);
  const names = comparableNames(candidate);

  if (names.some((name) => name === comparableKeyword)) return 0;
  if (
    candidate.comparableEupmyeondongName &&
    matchesEupmyeondongName(candidate, comparableKeyword)
  ) {
    return 1;
  }
  if (names.some((name) => name.startsWith(comparableKeyword))) return 2;
  return 3;
}

function matchesRegionKeyword(
  candidate: IndexedRegionSearchCandidate,
  keyword: string,
): boolean {
  const comparableKeyword = normalizeComparableRegionName(keyword);
  return (
    comparableNames(candidate).some((name) =>
      name.includes(comparableKeyword),
    ) || matchesEupmyeondongName(candidate, comparableKeyword)
  );
}

function comparableNames(candidate: IndexedRegionSearchCandidate): string[] {
  return [
    candidate.comparableSidoName,
    candidate.comparableSigunguName,
    candidate.comparableEupmyeondongName,
  ].filter((name): name is string => Boolean(name));
}

function matchesEupmyeondongName(
  candidate: IndexedRegionSearchCandidate,
  keyword: string,
): boolean {
  const comparableName = candidate.comparableEupmyeondongName;
  if (!comparableName) return false;
  const comparableKeyword = normalizeComparableRegionName(keyword);
  return (
    comparableName === comparableKeyword ||
    comparableName.startsWith(comparableKeyword) ||
    candidate.numberedDongAlias === comparableKeyword
  );
}

function sameSigunguName(
  candidate: IndexedRegionSearchCandidate,
  queryName: string,
): boolean {
  const firstName = candidate.comparableSigunguName;
  if (!firstName) return false;
  const secondName = normalizeComparableRegionName(queryName);
  return (
    firstName === secondName ||
    firstName.replace(/시$/, "") === secondName.replace(/시$/, "") ||
    (firstName.endsWith("시") && secondName.startsWith(firstName)) ||
    (secondName.endsWith("시") && firstName.startsWith(secondName))
  );
}

function estimateIndexStringBytes(
  candidates: readonly IndexedRegionSearchCandidate[],
  lookupKeys: Iterable<string>,
): number {
  const candidateStrings = candidates.flatMap((candidate) => [
    candidate.candidate.id,
    candidate.candidate.displayName,
    ...comparableNames(candidate),
    candidate.numberedDongAlias ?? "",
  ]);
  return [...candidateStrings, ...lookupKeys].reduce(
    (total, value) => total + utf8ByteLength(value),
    0,
  );
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

function tokenize(input: string): string[] {
  return input
    .normalize("NFC")
    .replace(/[()[\]]/g, " ")
    .trim()
    .split(WHITESPACE)
    .map((token) => token.replace(/^[,.\[\]()]+|[,.\[\]()]+$/g, ""))
    .filter(Boolean);
}
