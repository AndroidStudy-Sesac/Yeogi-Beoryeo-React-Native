import type { Region } from "./Region";
import { filterByName, filterChildren } from "./regionFilter";

const regions: Region[] = [
  { id: "seoul", name: "서울특별시", level: "sido" },
  { id: "gangnam", name: "강남구", level: "sigungu", parentId: "seoul" },
  { id: "mapo", name: "마포구", level: "sigungu", parentId: "seoul" },
  { id: "yeoksam", name: "역삼동", level: "eupmyeondong", parentId: "gangnam" },
];

describe("지역 필터", () => {
  it("선택한 상위 지역의 직속 하위 지역만 반환한다", () => {
    expect(
      filterChildren(regions, "seoul").map((region) => region.name),
    ).toEqual(["강남구", "마포구"]);
  });

  it("공백 검색어에는 모든 지역을 반환한다", () => {
    expect(filterByName(regions, "  ")).toEqual(regions);
  });

  it("이름 검색어를 포함한 지역만 반환한다", () => {
    expect(filterByName(regions, "강남")).toEqual([regions[1]]);
  });
});
