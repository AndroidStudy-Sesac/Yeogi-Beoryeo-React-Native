import fixture from "./__fixtures__/regionSearchFixtures.json";
import type { Region } from "./Region";
import type { RegionSearchResult } from "./RegionSearchModel";
import {
  classifyRegionSearchInput,
  searchAvailableRegions,
} from "./regionSearch";

const regions = fixture.regions as Region[];

describe("지역 검색 fixture", () => {
  it.each(fixture.classifications)(
    "$query 입력을 $expected 유형으로 분류한다",
    ({ query, expected }) => {
      expect(classifyRegionSearchInput(query)).toBe(expected);
    },
  );

  it.each(fixture.searches)(
    "$query 검색 결과를 제공 가능한 지역 후보로 변환한다",
    ({ query, status, displayNames }) => {
      const result = searchAvailableRegions(regions, query);

      expect(result.status).toBe(status);
      expect(resultDisplayNames(result)).toEqual(displayNames);
    },
  );
});

function resultDisplayNames(result: RegionSearchResult): string[] {
  if (result.status === "resolved") return [result.candidate.displayName];
  if (result.status === "candidates") {
    return result.candidates.map((candidate) => candidate.displayName);
  }
  return [];
}
