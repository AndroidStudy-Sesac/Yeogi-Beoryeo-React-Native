import type { RegionSearchResult } from '../domain/RegionSearch';
import {
  createRegionSearchIndex,
  searchRegionIndex,
  type RegionSearchIndex,
} from '../domain/regionSearchIndex';
import { getRegionCatalog, type RegionCatalog } from './regionRepository';

export type RegionSearchStatistics = Readonly<{
  indexBuildCount: number;
  searchCount: number;
  candidateCount?: number;
  exactKeyCount?: number;
}>;

export interface RegionSearchService {
  search(query: string, signal: AbortSignal): Promise<RegionSearchResult>;
  getStatistics(): RegionSearchStatistics;
}

export function createRegionSearchService(
  loadCatalog: () => RegionCatalog = getRegionCatalog,
): RegionSearchService {
  let index: RegionSearchIndex | undefined;
  let indexBuildCount = 0;
  let searchCount = 0;

  return {
    async search(query, signal) {
      await yieldToEventLoop();
      throwIfAborted(signal);

      if (!index) {
        const catalog = loadCatalog();
        index = createRegionSearchIndex(
          catalog.regions,
          catalog.searchAliasesByRegionId,
        );
        indexBuildCount += 1;
      }
      throwIfAborted(signal);

      const result = searchRegionIndex(index, query);
      searchCount += 1;
      throwIfAborted(signal);
      return result;
    },
    getStatistics() {
      return {
        indexBuildCount,
        searchCount,
        candidateCount: index?.candidateCount,
        exactKeyCount: index?.exactKeyCount,
      };
    },
  };
}

function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  const error = new Error('지역 검색이 취소되었습니다.');
  error.name = 'AbortError';
  throw error;
}
