import { createRegionSearchClient } from "./regionSearchClient";

describe("지역 검색 client", () => {
  const client = createRegionSearchClient();

  it("주소성 입력을 제공 가능한 시군구로 변환한다", async () => {
    const result = await client.search(
      "서울시 강남구 테헤란로 123",
      new AbortController().signal,
    );

    expect(result).toMatchObject({
      status: "resolved",
      candidate: { displayName: "서울특별시 강남구" },
    });
  });

  it("괄호 안 동명이 있는 도로명 주소를 읍면동 후보로 변환한다", async () => {
    const result = await client.search(
      "서울특별시 영등포구 문래로 110 (문래동)",
      new AbortController().signal,
    );

    expect(result).toMatchObject({
      status: "resolved",
      candidate: { displayName: "서울특별시 영등포구 문래동" },
    });
  });

  it("번호가 생략된 법정동 이름으로 제공 가능한 행정동 후보를 찾는다", async () => {
    const result = await client.search(
      "서울 강남구 역삼동",
      new AbortController().signal,
    );

    expect(result.status).toBe("candidates");
    if (result.status !== "candidates") return;
    expect(result.candidates.map((candidate) => candidate.displayName)).toEqual(
      ["서울특별시 강남구 역삼1동", "서울특별시 강남구 역삼2동"],
    );
  });

  it("행정구가 포함된 주소를 배출 안내 시 단위 후보로 정규화한다", async () => {
    const result = await client.search(
      "경기도 수원시 영통구 망포동",
      new AbortController().signal,
    );

    expect(result.status).toBe("candidates");
    if (result.status !== "candidates") return;
    expect(result.candidates.map((candidate) => candidate.displayName)).toEqual(
      ["경기도 수원시 망포1동", "경기도 수원시 망포2동"],
    );
  });
});
