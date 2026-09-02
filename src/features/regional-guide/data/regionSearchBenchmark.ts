import type { RegionSearchResult } from "../domain/RegionSearchModel";
import {
  createRegionSearchIndex,
  estimateRegionSearchIndexStringBytes,
  searchAvailableRegions,
  searchRegionIndex,
} from "../domain/regionSearch";
import { getAvailableRegions } from "./regionRepository";

export const REGION_SEARCH_BENCHMARK_QUERIES = [
  "서울시 강남구 테헤란로 123",
  "역삼동",
  "경기도 수원시 영통구 망포동",
  "강원도 강릉시",
  "없는동",
] as const;

export interface RegionSearchBenchmarkResult {
  iterationCount: number;
  resultConsistency: boolean;
  baselineFirstSearchMilliseconds: number;
  baselineAverageSearchMilliseconds: number;
  baselineMaximumSearchMilliseconds: number;
  indexBuildMilliseconds: number;
  indexedFirstRequestMilliseconds: number;
  indexedFirstSearchMilliseconds: number;
  indexedAverageSearchMilliseconds: number;
  indexedMaximumSearchMilliseconds: number;
  estimatedIndexStringBytes: number;
}

/**
 * 사용자가 명시적으로 실행하는 Spike 비교 측정입니다.
 * baseline은 매 검색마다 인덱스를 만들고, indexed는 같은 인덱스를 재사용합니다.
 */
export function runRegionSearchBenchmark(
  iterationCount = 10,
): RegionSearchBenchmarkResult {
  const regions = getAvailableRegions();
  const baselineFirst = measure(() =>
    searchAvailableRegions(regions, REGION_SEARCH_BENCHMARK_QUERIES[0]),
  );
  const baselineMeasurements = measureSearches(iterationCount, (query) =>
    searchAvailableRegions(regions, query),
  );

  const indexBuild = measure(() => createRegionSearchIndex(regions));
  const index = indexBuild.value;
  const indexedFirst = measure(() =>
    searchRegionIndex(index, REGION_SEARCH_BENCHMARK_QUERIES[0]),
  );
  const indexedMeasurements = measureSearches(iterationCount, (query) =>
    searchRegionIndex(index, query),
  );
  const resultConsistency = REGION_SEARCH_BENCHMARK_QUERIES.every(
    (query) =>
      resultSignature(searchAvailableRegions(regions, query)) ===
      resultSignature(searchRegionIndex(index, query)),
  );

  return {
    iterationCount,
    resultConsistency,
    baselineFirstSearchMilliseconds: baselineFirst.milliseconds,
    baselineAverageSearchMilliseconds: average(baselineMeasurements),
    baselineMaximumSearchMilliseconds: Math.max(...baselineMeasurements),
    indexBuildMilliseconds: indexBuild.milliseconds,
    indexedFirstRequestMilliseconds:
      indexBuild.milliseconds + indexedFirst.milliseconds,
    indexedFirstSearchMilliseconds: indexedFirst.milliseconds,
    indexedAverageSearchMilliseconds: average(indexedMeasurements),
    indexedMaximumSearchMilliseconds: Math.max(...indexedMeasurements),
    estimatedIndexStringBytes: estimateRegionSearchIndexStringBytes(index),
  };
}

function measureSearches(
  iterationCount: number,
  search: (query: string) => RegionSearchResult,
): number[] {
  const measurements: number[] = [];
  for (let iteration = 0; iteration < iterationCount; iteration += 1) {
    for (const query of REGION_SEARCH_BENCHMARK_QUERIES) {
      measurements.push(measure(() => search(query)).milliseconds);
    }
  }
  return measurements;
}

function resultSignature(result: RegionSearchResult): string {
  if (result.status === "not-found") return result.status;
  if (result.status === "resolved") {
    return `${result.status}:${result.candidate.id}`;
  }
  return `${result.status}:${result.candidates
    .map((candidate) => candidate.id)
    .join(",")}`;
}

function measure<T>(block: () => T): { value: T; milliseconds: number } {
  const startedAt = now();
  const value = block();
  return { value, milliseconds: now() - startedAt };
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}
