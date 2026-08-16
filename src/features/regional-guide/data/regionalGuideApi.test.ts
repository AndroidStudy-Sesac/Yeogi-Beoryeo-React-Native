import {
  createRegionalGuideApiConfig,
  createRegionalGuideApiClient,
  fetchRegionalDisposalGuides,
  mapRegionalGuideItem,
} from "./regionalGuideApi";

const config = { serviceKey: "test-key" };

describe("지역별 배출 안내 API", () => {
  it("시군구 조건과 Android와 같은 요청 파라미터로 조회한다", async () => {
    const request = jest.fn().mockResolvedValue(jsonResponse(apiResponse([guideItem()])));

    await fetchRegionalDisposalGuides("수원시", config, undefined, request);

    const [url, options] = request.mock.calls[0] as [string, { signal?: AbortSignal }];
    const params = new URL(url).searchParams;
    expect(params.get("cond[SGG_NM::LIKE]")).toBe("수원시");
    expect(params.get("returnType")).toBe("json");
    expect(params.get("serviceKey")).toBe("test-key");
    expect(options.signal).toBeUndefined();
  });

  it("일반·음식물·재활용 배출 정보를 공통 모델로 변환한다", () => {
    expect(mapRegionalGuideItem(guideItem())).toEqual({
      sidoName: "경기도",
      sigunguName: "수원시",
      managementZoneName: "장안구",
      targetRegionName: "정자동",
      disposalPlaceType: "문전수거",
      disposalPlace: "내 집 앞",
      uncollectedDays: "일, 공휴일",
      schedules: [
        {
          wasteType: "general",
          disposalDays: "월, 수",
          disposalStartTime: "18:00",
          disposalEndTime: "23:00",
          disposalMethod: "종량제 봉투 배출",
        },
        { wasteType: "food", disposalDays: "매일", disposalMethod: "전용 수거함 배출" },
        { wasteType: "recyclable", disposalDays: "목", disposalStartTime: "20:00" },
      ],
      departmentName: "청소행정과",
      departmentPhoneNumber: "031-123-4567",
    });
  });

  it("성공 응답에 유효한 항목이 없으면 결과 없음으로 분류한다", async () => {
    const request = jest.fn().mockResolvedValue(jsonResponse(apiResponse([{ CTPV_NM: "  " }])));

    await expect(fetchRegionalDisposalGuides("수원시", config, undefined, request)).resolves.toEqual({
      status: "not-found",
    });
  });

  it("단일 항목 응답과 Android API의 숫자 성공 코드 0을 처리한다", async () => {
    const request = jest.fn().mockResolvedValue(
      jsonResponse({ response: { header: { resultCode: 0 }, body: { items: { item: guideItem() } } } }),
    );

    await expect(fetchRegionalDisposalGuides("수원시", config, undefined, request)).resolves.toMatchObject({
      status: "success",
      guides: [expect.objectContaining({ sigunguName: "수원시" })],
    });
  });

  it("totalCount가 페이지 크기를 넘으면 모든 페이지를 합쳐 조회한다", async () => {
    const firstItem = { ...guideItem(), MNG_ZONE_NM: "1권역" };
    const secondItem = { ...guideItem(), MNG_ZONE_NM: "2권역" };
    const request = jest.fn((url: string) => {
      const pageNo = new URL(url).searchParams.get("pageNo");
      return Promise.resolve(
        jsonResponse(apiResponse(pageNo === "1" ? [firstItem] : [secondItem], 2)),
      );
    });

    await expect(fetchRegionalDisposalGuides("수원시", config, undefined, request)).resolves.toMatchObject({
      status: "success",
      guides: [
        expect.objectContaining({ managementZoneName: "1권역" }),
        expect.objectContaining({ managementZoneName: "2권역" }),
      ],
    });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("네트워크, HTTP API, API 헤더 오류를 구분한다", async () => {
    const networkRequest = jest.fn().mockRejectedValue(new TypeError("Network request failed"));
    const httpRequest = jest.fn().mockResolvedValue(new Response(null, { status: 500 }));
    const apiRequest = jest.fn().mockResolvedValue(
      jsonResponse({ response: { header: { resultCode: "30" } } }),
    );
    const malformedRequest = jest.fn().mockResolvedValue(
      jsonResponse({ response: { header: { resultCode: "00" } } }),
    );

    await expect(fetchRegionalDisposalGuides("수원시", config, undefined, networkRequest)).resolves.toEqual({
      status: "failure",
      reason: "network",
    });
    await expect(fetchRegionalDisposalGuides("수원시", config, undefined, httpRequest)).resolves.toEqual({
      status: "failure",
      reason: "api",
    });
    await expect(fetchRegionalDisposalGuides("수원시", config, undefined, apiRequest)).resolves.toEqual({
      status: "failure",
      reason: "api",
    });
    await expect(fetchRegionalDisposalGuides("수원시", config, undefined, malformedRequest)).resolves.toEqual({
      status: "failure",
      reason: "api",
    });
  });

  it("취소는 오류 결과로 바꾸지 않고 호출자에게 전파한다", async () => {
    const controller = new AbortController();
    const abortError = new Error("cancelled");
    abortError.name = "AbortError";
    const request = jest.fn().mockRejectedValue(abortError);

    await expect(fetchRegionalDisposalGuides("수원시", config, controller.signal, request)).rejects.toBe(
      abortError,
    );
    expect(request.mock.calls[0][1]).toEqual({ signal: controller.signal });
  });

  it("환경 키가 없으면 네트워크 요청 없이 구성 오류를 반환한다", async () => {
    const request = jest.fn();

    await expect(
      fetchRegionalDisposalGuides("수원시", createRegionalGuideApiConfig({}), undefined, request),
    ).resolves.toEqual({ status: "failure", reason: "configuration" });
    expect(request).not.toHaveBeenCalled();
  });

  it("API 클라이언트는 주입된 구성과 요청 구현을 사용한다", async () => {
    const request = jest.fn().mockResolvedValue(jsonResponse(apiResponse([guideItem()])));
    const client = createRegionalGuideApiClient(config, request);

    await expect(client.fetchRegionalDisposalGuides("수원시")).resolves.toMatchObject({
      status: "success",
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function apiResponse(items: unknown[], totalCount?: number) {
  return {
    response: {
      header: { resultCode: "00" },
      body: { items: { item: items }, ...(totalCount === undefined ? {} : { totalCount }) },
    },
  };
}

function guideItem() {
  return {
    CTPV_NM: "경기도",
    SGG_NM: "수원시",
    MNG_ZONE_NM: "장안구",
    MNG_ZONE_TRGT_RGN_NM: "정자동",
    EMSN_PLC_TYPE: "문전수거",
    EMSN_PLC: "내 집 앞",
    UNCLLT_DAY: "일요일+공휴일",
    LF_WST_EMSN_DOW: "월요일,수요일",
    LF_WST_EMSN_BGNG_TM: "1800",
    LF_WST_EMSN_END_TM: "2300",
    LF_WST_EMSN_MTHD: "종량제 봉투 배출",
    FOD_WST_EMSN_DOW: "매일",
    FOD_WST_EMSN_MTHD: "전용 수거함 배출",
    RCYCL_EMSN_DOW: "목요일",
    RCYCL_EMSN_BGNG_TM: "2000",
    MNG_DEPT_NM: "청소행정과",
    MNG_DEPT_TELNO: "031-123-4567",
  };
}
