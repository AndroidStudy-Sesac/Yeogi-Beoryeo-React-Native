import { runRegionSearchBenchmark } from "./regionSearchBenchmark";

describe("지역 검색 성능 비교", () => {
  it("실제 asset에서 재계산과 인덱스 재사용 결과가 동일하다", () => {
    const result = runRegionSearchBenchmark(2);

    console.info("region search benchmark", result);

    expect(result.resultConsistency).toBe(true);
    expect(result.iterationCount).toBe(2);
    expect(result.indexBuildMilliseconds).toBeGreaterThanOrEqual(0);
    expect(result.indexedAverageSearchMilliseconds).toBeGreaterThanOrEqual(0);
    expect(result.indexedFirstRequestMilliseconds).toBe(
      result.indexBuildMilliseconds + result.indexedFirstSearchMilliseconds,
    );
    expect(result.estimatedIndexStringBytes).toBeGreaterThan(0);
  });
});
