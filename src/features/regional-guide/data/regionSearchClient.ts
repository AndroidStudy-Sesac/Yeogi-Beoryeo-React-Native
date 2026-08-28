import type { RegionSearchResult } from "../domain/RegionSearchModel";
import { searchAvailableRegions } from "../domain/regionSearch";
import { getAvailableRegions } from "./regionRepository";

export interface RegionSearchClient {
  search(query: string, signal: AbortSignal): Promise<RegionSearchResult>;
}

export function createRegionSearchClient(): RegionSearchClient {
  return {
    async search(query, signal) {
      await Promise.resolve();
      if (signal.aborted) throw abortError();

      const result = searchAvailableRegions(getAvailableRegions(), query);
      if (signal.aborted) throw abortError();
      return result;
    },
  };
}

function abortError(): Error {
  const error = new Error("지역 검색이 취소되었습니다.");
  error.name = "AbortError";
  return error;
}
