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

export function searchAvailableRegions(
  regions: readonly Region[],
  query: string,
): RegionSearchResult {
  if (classifyRegionSearchInput(query) === "empty") {
    return { status: "not-found" };
  }

  const parsedQuery = parseSearchQuery(query);
  if (!hasMeaningfulSearchCriteria(parsedQuery)) {
    return { status: "not-found" };
  }
  const candidates = createCandidates(regions).filter((candidate) =>
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
  candidate: RegionSearchCandidate,
  query: ParsedSearchQuery,
): boolean {
  const { sido, sigungu, eupmyeondong } = candidate.region;
  if (!sido || !sigungu) return false;

  if (
    query.sidoName &&
    normalizeSidoName(sido.name, sigungu.name) !== query.sidoName
  ) {
    return false;
  }

  if (query.sigunguName) {
    if (!sameSigunguName(sigungu.name, query.sigunguName)) return false;
    if (!query.eupmyeondongName) return eupmyeondong === undefined;
  }

  if (query.eupmyeondongName) {
    return (
      eupmyeondong !== undefined &&
      matchesEupmyeondongName(eupmyeondong.name, query.eupmyeondongName)
    );
  }

  if (query.remainingKeyword) {
    return matchesRegionKeyword(candidate, query.remainingKeyword);
  }

  return eupmyeondong === undefined;
}

function rankCandidates(
  candidates: RegionSearchCandidate[],
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
    .map(({ candidate }) => candidate)
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

function matchScore(candidate: RegionSearchCandidate, keyword: string): number {
  const comparableKeyword = normalizeComparableRegionName(keyword);
  const names = [
    candidate.region.eupmyeondong?.name,
    candidate.region.sigungu?.name,
    candidate.region.sido?.name,
  ].filter((name): name is string => Boolean(name));

  if (
    names.some(
      (name) => normalizeComparableRegionName(name) === comparableKeyword,
    )
  ) {
    return 0;
  }
  if (
    candidate.region.eupmyeondong &&
    matchesEupmyeondongName(
      candidate.region.eupmyeondong.name,
      comparableKeyword,
    )
  ) {
    return 1;
  }
  if (
    names.some((name) =>
      normalizeComparableRegionName(name).startsWith(comparableKeyword),
    )
  ) {
    return 2;
  }
  return 3;
}

function matchesRegionKeyword(
  candidate: RegionSearchCandidate,
  keyword: string,
): boolean {
  const comparableKeyword = normalizeComparableRegionName(keyword);
  return [
    candidate.region.sido?.name,
    candidate.region.sigungu?.name,
    candidate.region.eupmyeondong?.name,
  ]
    .filter((name): name is string => Boolean(name))
    .some((name) => {
      const comparableName = normalizeComparableRegionName(name);
      return (
        comparableName.includes(comparableKeyword) ||
        matchesEupmyeondongName(comparableName, comparableKeyword)
      );
    });
}

function matchesEupmyeondongName(name: string, keyword: string): boolean {
  const comparableName = normalizeComparableRegionName(name);
  const comparableKeyword = normalizeComparableRegionName(keyword);
  if (
    comparableName === comparableKeyword ||
    comparableName.startsWith(comparableKeyword)
  ) {
    return true;
  }

  const numberedDongMatch = NUMBERED_DONG.exec(comparableName);
  return numberedDongMatch
    ? `${numberedDongMatch[1]}동` === comparableKeyword
    : false;
}

function sameSigunguName(first: string, second: string): boolean {
  const firstName = normalizeComparableRegionName(first);
  const secondName = normalizeComparableRegionName(second);
  return (
    firstName === secondName ||
    firstName.replace(/시$/, "") === secondName.replace(/시$/, "") ||
    (firstName.endsWith("시") && secondName.startsWith(firstName)) ||
    (secondName.endsWith("시") && firstName.startsWith(secondName))
  );
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
