import { createRegionAssetLoadResult } from "./regionRepository";

describe("지역 asset 변환", () => {
  it("유효하지 않은 행을 제외하고 제공 가능 읍면동만 선택지로 만든다", () => {
    const result = createRegionAssetLoadResult(
      [
        { sidoName: "서울특별시", sigunguName: "강남구" },
        { sidoName: "", sigunguName: "누락구" },
      ],
      [
        {
          sidoName: "서울특별시",
          sigunguName: "강남구",
          managementZoneName: "1권역",
          targetRegionName: "역삼1동",
        },
      ],
      [
        {
          adminCode: "1",
          sidoName: "서울특별시",
          sigunguName: "강남구",
          eupmyeondongName: "역삼1동",
        },
        {
          adminCode: "2",
          sidoName: "서울특별시",
          sigunguName: "강남구",
          eupmyeondongName: "대치동",
        },
        {
          adminCode: "3",
          sidoName: "서울특별시",
          sigunguName: "강남구",
          eupmyeondongName: "",
        },
      ],
    );

    expect(result.invalidRecordCount).toBe(2);
    expect(result.regions.map((region) => region.name)).toEqual([
      "서울특별시",
      "강남구",
      "역삼1동",
    ]);
  });

  it("세부 지역을 명시하지 않은 제공 범위는 해당 시군구의 모든 읍면동을 노출한다", () => {
    const result = createRegionAssetLoadResult(
      [{ sidoName: "서울특별시", sigunguName: "강북구" }],
      [
        {
          sidoName: "서울특별시",
          sigunguName: "강북구",
          managementZoneName: "강북구전역",
          targetRegionName: "강북구전역",
        },
      ],
      [
        {
          adminCode: "1",
          sidoName: "서울특별시",
          sigunguName: "강북구",
          eupmyeondongName: "번1동",
        },
        {
          adminCode: "2",
          sidoName: "서울특별시",
          sigunguName: "강북구",
          eupmyeondongName: "번2동",
        },
      ],
    );

    expect(
      result.regions
        .filter((region) => region.level === "eupmyeondong")
        .map((region) => region.name),
    ).toEqual(["번1동", "번2동"]);
  });
});
