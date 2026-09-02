import fixture from "./__fixtures__/regionSearchFixtures.json";
import type { Region } from "./Region";
import type { RegionSearchResult } from "./RegionSearchModel";
import {
  classifyRegionSearchInput,
  createRegionSearchIndex,
  searchAvailableRegions,
  searchRegionIndex,
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

  it.each(fixture.searches)(
    "$query 인덱스 검색 결과가 매번 재계산한 결과와 동일하다",
    ({ query }) => {
      const index = createRegionSearchIndex(regions);

      expect(searchRegionIndex(index, query)).toEqual(
        searchAvailableRegions(regions, query),
      );
    },
  );

  it("시도·시군구·읍면동·번호 생략 별칭 key를 한 후보 ID로 중복 제거한다", () => {
    const index = createRegionSearchIndex(regions);
    const candidates = index.candidatesByExactKey.get("역삼동");

    expect(candidates?.map(({ candidate }) => candidate.displayName)).toEqual([
      "서울특별시 강남구 역삼1동",
      "서울특별시 강남구 역삼2동",
    ]);
    expect(new Set(candidates?.map(({ candidate }) => candidate.id)).size).toBe(
      candidates?.length,
    );
  });
});

function resultDisplayNames(result: RegionSearchResult): string[] {
  if (result.status === "resolved") return [result.candidate.displayName];
  if (result.status === "candidates") {
    return result.candidates.map((candidate) => candidate.displayName);
  }
  return [];
}
