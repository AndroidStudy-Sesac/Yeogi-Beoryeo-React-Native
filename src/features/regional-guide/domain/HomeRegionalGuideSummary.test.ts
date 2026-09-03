import { toHomeRegionalGuideSummary } from "./HomeRegionalGuideSummary";

describe("toHomeRegionalGuideSummary", () => {
  it("홈에 필요한 지역·장소·품목별 요일과 시간만 변환한다", () => {
    expect(
      toHomeRegionalGuideSummary(
        {
          sidoName: "강원특별자치도",
          sigunguName: "강릉시",
          targetRegionName: "강남동",
          disposalPlace: "지정 배출장소",
          schedules: [
            {
              wasteType: "general",
              disposalDays: "월, 수",
              disposalStartTime: "18:00",
              disposalEndTime: "24:00",
              disposalMethod: "종량제 봉투",
            },
          ],
        },
        "fallback",
      ),
    ).toEqual({
      regionName: "강원특별자치도 > 강릉시 > 강남동",
      disposalPlace: "지정 배출장소",
      schedules: [
        {
          wasteType: "general",
          disposalDays: "월, 수",
          disposalTime: "18:00~24:00",
        },
      ],
    });
  });

  it("API 지역명이 없으면 안정 식별자로 복원한 asset 경로를 사용한다", () => {
    expect(
      toHomeRegionalGuideSummary({ schedules: [] }, "서울 > 강남구").regionName,
    ).toBe("서울 > 강남구");
  });
});
