import { statSync } from "node:fs";
import { resolve } from "node:path";

import {
  createRegionAssetLoadResult,
  estimateRegionModelBytes,
  getRegionAssetLoadMetrics,
  REGION_ASSET_SOURCE_STATS,
} from "./regionRepository";

describe("지역 asset 변환", () => {
  it("실제 asset 크기와 row 수 메타데이터를 유지한다", () => {
    const paths = [
      "src/features/regional-guide/data/regions.json",
      "src/features/regional-guide/data/assets/administrativeRegions.json",
      "src/features/regional-guide/data/assets/regionalGuideAvailability.json",
    ];

    expect(paths.map((path) => statSync(resolve(path)).size)).toEqual(
      REGION_ASSET_SOURCE_STATS.map((source) => source.sourceBytes),
    );
    const metrics = getRegionAssetLoadMetrics();
    console.info("region asset metrics", metrics);

    expect(metrics).toMatchObject({
      sourceBytes: 1_400_502,
      sourceRowCount: 7_108,
      invalidRecordCount: 0,
    });
    expect(metrics).not.toHaveProperty("estimatedRegionModelBytes");
    expect(estimateRegionModelBytes()).toBeGreaterThan(0);
  });

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

  it("행정구가 포함된 행정동을 배출 안내 시 단위 범위에 연결한다", () => {
    const result = createRegionAssetLoadResult(
      [{ sidoName: "경기도", sigunguName: "수원시" }],
      [
        {
          sidoName: "경기도",
          sigunguName: "수원시",
          managementZoneName: "망포1동",
          targetRegionName: "망포1동",
        },
      ],
      [
        {
          adminCode: "1",
          sidoName: "경기도",
          sigunguName: "수원시 영통구",
          eupmyeondongName: "망포1동",
        },
      ],
    );

    expect(result.regions.map((region) => region.name)).toEqual([
      "경기도",
      "수원시",
      "망포1동",
    ]);
  });
});
