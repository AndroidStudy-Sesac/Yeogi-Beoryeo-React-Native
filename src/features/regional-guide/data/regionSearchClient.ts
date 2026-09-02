import type { RegionSearchResult } from "../domain/RegionSearchModel";
import {
  createRegionSearchIndex,
  searchRegionIndex,
  type RegionSearchIndex,
} from "../domain/regionSearch";
import { getAvailableRegions } from "./regionRepository";

export interface RegionSearchPerformanceSnapshot {
  indexBuildCount: number;
  indexBuildMilliseconds?: number;
  indexCandidateCount?: number;
  indexLookupKeyCount?: number;
  searchCount: number;
  firstRequestMilliseconds?: number;
  latestRequestMilliseconds?: number;
  firstSearchMilliseconds?: number;
  latestSearchMilliseconds?: number;
  latestQuery?: string;
}

export interface RegionSearchClient {
  search(query: string, signal: AbortSignal): Promise<RegionSearchResult>;
  getPerformanceSnapshot?(): RegionSearchPerformanceSnapshot;
}

export function createRegionSearchClient(): RegionSearchClient {
  let index: RegionSearchIndex | undefined;
  const performanceSnapshot: RegionSearchPerformanceSnapshot = {
    indexBuildCount: 0,
    searchCount: 0,
  };

  return {
    async search(query, signal) {
      const requestStartedAt = now();
      // searching 상태가 먼저 렌더링되고 새 입력/화면 이탈이 취소 신호를 보낼 기회를 줍니다.
      await yieldToEventLoop();
      if (signal.aborted) throw abortError();

      if (!index) {
        const startedAt = now();
        index = createRegionSearchIndex(getAvailableRegions());
        performanceSnapshot.indexBuildMilliseconds = now() - startedAt;
        performanceSnapshot.indexBuildCount += 1;
        performanceSnapshot.indexCandidateCount = index.candidateCount;
        performanceSnapshot.indexLookupKeyCount = index.lookupKeyCount;
      }
      if (signal.aborted) throw abortError();

      const startedAt = now();
      const result = searchRegionIndex(index, query);
      const searchMilliseconds = now() - startedAt;
      performanceSnapshot.searchCount += 1;
      performanceSnapshot.firstSearchMilliseconds ??= searchMilliseconds;
      performanceSnapshot.latestSearchMilliseconds = searchMilliseconds;
      const requestMilliseconds = now() - requestStartedAt;
      performanceSnapshot.firstRequestMilliseconds ??= requestMilliseconds;
      performanceSnapshot.latestRequestMilliseconds = requestMilliseconds;
      performanceSnapshot.latestQuery = query;

      if (signal.aborted) throw abortError();
      return result;
    },
    getPerformanceSnapshot() {
      return { ...performanceSnapshot };
    },
  };
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function abortError(): Error {
  const error = new Error("지역 검색이 취소되었습니다.");
  error.name = "AbortError";
  return error;
}

function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}
