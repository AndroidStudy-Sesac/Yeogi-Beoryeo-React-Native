import { findRegions } from "../data/regionRepository";
import {
  createRegionalGuideId,
  readRegionalGuideRegionId,
} from "./RegionalGuideFavorite";

describe("RegionalGuideFavorite", () => {
  it("표시명 대신 선택 지역의 안정 식별자로 가이드 식별자를 만든다", () => {
    const sido = findRegions("sido").find(
      (region) => region.name === "강원특별자치도",
    );
    const sigungu = findRegions("sigungu", sido?.id).find(
      (region) => region.name === "강릉시",
    );
    const eupmyeondong = findRegions("eupmyeondong", sigungu?.id).find(
      (region) => region.name === "강남동",
    );

    const guideId = createRegionalGuideId({ sido, sigungu, eupmyeondong });

    expect(guideId).toBeDefined();
    expect(readRegionalGuideRegionId(guideId!)).toBe(eupmyeondong?.id);
    expect(readRegionalGuideRegionId(guideId!)).toMatch(
      /^eupmyeondong:\d{10}$/,
    );
    expect(guideId).not.toBe("강남동");
    expect(guideId).not.toMatch(/[가-힣]/);
  });

  it("시군구가 없는 특별자치시도 행정코드 기반 식별자를 사용한다", () => {
    const sido = findRegions("sido").find(
      (region) => region.name === "세종특별자치시",
    );
    const sigungu = findRegions("sigungu", sido?.id).find(
      (region) => region.name === "없음",
    );

    const guideId = createRegionalGuideId({ sido, sigungu });

    expect(readRegionalGuideRegionId(guideId!)).toBe("sigungu:36110");
    expect(guideId).not.toMatch(/[가-힣]/);
  });
});
