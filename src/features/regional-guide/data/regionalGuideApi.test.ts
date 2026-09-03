import {
  createRegionalGuideApiConfig,
  createRegionalGuideApiClient,
  fetchRegionalDisposalGuides,
  mapRegionalGuideItem,
  type RegionalGuideRecoveryPolicy,
} from "./regionalGuideApi";

const config = { serviceKey: "test-key" };
const testPolicy: RegionalGuideRecoveryPolicy = {
  pageTimeoutMs: 100,
  totalTimeoutMs: 500,
  maxPageCount: 5,
};

describe("지역별 배출 안내 API", () => {
  afterEach(() => jest.useRealTimers());

  it("시군구 조건과 Android와 같은 요청 파라미터로 조회한다", async () => {
    const request = jest
      .fn()
      .mockResolvedValue(jsonResponse(apiResponse([guideItem()], 1)));

    await fetchRegionalDisposalGuides(
      "수원시",
      config,
      undefined,
      request,
      testPolicy,
    );

    const [url, options] = request.mock.calls[0] as [
      string,
      { signal?: AbortSignal },
    ];
    const params = new URL(url).searchParams;
    expect(params.get("cond[SGG_NM::LIKE]")).toBe("수원시");
    expect(params.get("returnType")).toBe("json");
    expect(params.get("serviceKey")).toBe("test-key");
    expect(params.get("pageNo")).toBe("1");
    expect(params.get("numOfRows")).toBe("100");
    expect(options.signal).toBeInstanceOf(AbortSignal);
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
        {
          wasteType: "food",
          disposalDays: "매일",
          disposalMethod: "전용 수거함 배출",
        },
        {
          wasteType: "recyclable",
          disposalDays: "목",
          disposalStartTime: "20:00",
        },
      ],
      departmentName: "청소행정과",
      departmentPhoneNumber: "031-123-4567",
    });
  });

  it("1페이지 정상 완료 결과를 반환한다", async () => {
    const request = jest
      .fn()
      .mockResolvedValue(jsonResponse(apiResponse([guideItem("1권역")], 1)));

    await expect(
      fetchRegionalDisposalGuides(
        "수원시",
        config,
        undefined,
        request,
        testPolicy,
      ),
    ).resolves.toMatchObject({
      status: "success",
      guides: [expect.objectContaining({ managementZoneName: "1권역" })],
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("여러 페이지 정상 완료 결과를 순서대로 병합한다", async () => {
    const request = jest.fn((url: string) => {
      const pageNo = Number(new URL(url).searchParams.get("pageNo"));
      return Promise.resolve(
        jsonResponse(apiResponse([guideItem(`${pageNo}권역`)], 3, 1)),
      );
    });

    await expect(
      fetchRegionalDisposalGuides(
        "수원시",
        config,
        undefined,
        request,
        testPolicy,
      ),
    ).resolves.toMatchObject({
      status: "success",
      guides: [
        expect.objectContaining({ managementZoneName: "1권역" }),
        expect.objectContaining({ managementZoneName: "2권역" }),
        expect.objectContaining({ managementZoneName: "3권역" }),
      ],
    });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("성공 응답에 유효한 항목이 없으면 결과 없음으로 분류한다", async () => {
    const request = jest
      .fn()
      .mockResolvedValue(jsonResponse(apiResponse([{ CTPV_NM: "  " }], 1)));

    await expect(
      fetchRegionalDisposalGuides(
        "수원시",
        config,
        undefined,
        request,
        testPolicy,
      ),
    ).resolves.toEqual({ status: "not-found" });
  });

  it("단일 항목 응답과 Android API의 숫자 성공 코드 0을 처리한다", async () => {
    const request = jest.fn().mockResolvedValue(
      jsonResponse({
        response: {
          header: { resultCode: 0 },
          body: { items: { item: guideItem() }, totalCount: 1 },
        },
      }),
    );

    await expect(
      fetchRegionalDisposalGuides(
        "수원시",
        config,
        undefined,
        request,
        testPolicy,
      ),
    ).resolves.toMatchObject({
      status: "success",
      guides: [expect.objectContaining({ sigunguName: "수원시" })],
    });
  });

  it.each([
    ["network" as const, new TypeError("Network request failed")],
    ["api" as const, new Response(null, { status: 500 })],
    [
      "api" as const,
      jsonResponse({ response: { header: { resultCode: "30" } } }),
    ],
  ])("첫 페이지 %s 오류는 전체 실패로 반환한다", async (reason, failure) => {
    const request =
      failure instanceof Error
        ? jest.fn().mockRejectedValue(failure)
        : jest.fn().mockResolvedValue(failure);

    await expect(
      fetchRegionalDisposalGuides(
        "수원시",
        config,
        undefined,
        request,
        testPolicy,
      ),
    ).resolves.toEqual({ status: "failure", reason });
  });

  it("첫 페이지 timeout은 전체 실패로 반환한다", async () => {
    jest.useFakeTimers();
    const request = jest.fn(() => new Promise<Response>(() => undefined));
    const result = fetchRegionalDisposalGuides(
      "수원시",
      config,
      undefined,
      request,
      testPolicy,
    );

    await jest.advanceTimersByTimeAsync(testPolicy.pageTimeoutMs);

    await expect(result).resolves.toEqual({
      status: "failure",
      reason: "timeout",
    });
  });

  it.each([
    ["network" as const, new TypeError("Network request failed")],
    ["api" as const, new Response(null, { status: 500 })],
  ])(
    "후속 페이지 %s 오류는 앞 페이지를 partial result로 반환한다",
    async (reason, failure) => {
      const request = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(apiResponse([guideItem("1권역")], 2, 1)),
        );
      if (failure instanceof Error) request.mockRejectedValueOnce(failure);
      else request.mockResolvedValueOnce(failure);

      await expect(
        fetchRegionalDisposalGuides(
          "수원시",
          config,
          undefined,
          request,
          testPolicy,
        ),
      ).resolves.toEqual({
        status: "partial",
        guides: [expect.objectContaining({ managementZoneName: "1권역" })],
        metadata: {
          reason,
          fetchedPageCount: 1,
          receivedItemCount: 1,
          totalCount: 2,
          failedPageNo: 2,
          duplicateGuideCount: 0,
        },
      });
    },
  );

  it("후속 페이지 timeout은 앞 페이지를 partial result로 반환한다", async () => {
    jest.useFakeTimers();
    const request = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(apiResponse([guideItem("1권역")], 2, 1)),
      )
      .mockImplementationOnce(() => new Promise<Response>(() => undefined));
    const result = fetchRegionalDisposalGuides(
      "수원시",
      config,
      undefined,
      request,
      testPolicy,
    );

    await jest.advanceTimersByTimeAsync(testPolicy.pageTimeoutMs);

    await expect(result).resolves.toMatchObject({
      status: "partial",
      guides: [expect.objectContaining({ managementZoneName: "1권역" })],
      metadata: { reason: "timeout", failedPageNo: 2 },
    });
  });

  it("페이지별 제한 안의 응답도 전체 time budget을 넘으면 partial result로 종료한다", async () => {
    jest.useFakeTimers();
    const request = jest.fn(
      (url: string, options?: { signal?: AbortSignal }) => {
        const pageNo = Number(new URL(url).searchParams.get("pageNo"));
        return delayedResponse(
          apiResponse([guideItem(`${pageNo}권역`)], 3, 1),
          40,
          options?.signal,
        );
      },
    );
    const result = fetchRegionalDisposalGuides(
      "수원시",
      config,
      undefined,
      request,
      { ...testPolicy, pageTimeoutMs: 50, totalTimeoutMs: 90 },
    );

    await jest.advanceTimersByTimeAsync(90);

    await expect(result).resolves.toMatchObject({
      status: "partial",
      guides: [
        expect.objectContaining({ managementZoneName: "1권역" }),
        expect.objectContaining({ managementZoneName: "2권역" }),
      ],
      metadata: {
        reason: "timeout",
        fetchedPageCount: 2,
        failedPageNo: 3,
      },
    });
  });

  it("외부 cancellation은 첫 페이지와 후속 페이지 모두 결과로 변환하지 않는다", async () => {
    const firstController = new AbortController();
    const firstAbort = abortError("first cancelled");
    const pendingRequest = jest.fn(
      () => new Promise<Response>(() => undefined),
    );
    const firstResult = fetchRegionalDisposalGuides(
      "수원시",
      config,
      firstController.signal,
      pendingRequest,
      testPolicy,
    );

    firstController.abort(firstAbort);

    await expect(firstResult).rejects.toBe(firstAbort);

    const nextController = new AbortController();
    const nextAbort = abortError("next cancelled");
    const nextRequest = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(apiResponse([guideItem("1권역")], 2, 1)),
      )
      .mockImplementationOnce(() => new Promise<Response>(() => undefined));
    const nextResult = fetchRegionalDisposalGuides(
      "수원시",
      config,
      nextController.signal,
      nextRequest,
      testPolicy,
    );
    await Promise.resolve();

    nextController.abort(nextAbort);

    await expect(nextResult).rejects.toBe(nextAbort);
  });

  it("비정상 totalCount는 최대 페이지 상한에서 partial result로 종료한다", async () => {
    const request = jest.fn((url: string) => {
      const pageNo = Number(new URL(url).searchParams.get("pageNo"));
      return Promise.resolve(
        jsonResponse(apiResponse([guideItem(`${pageNo}권역`)], 10_000, 1)),
      );
    });

    await expect(
      fetchRegionalDisposalGuides("수원시", config, undefined, request, {
        ...testPolicy,
        maxPageCount: 3,
      }),
    ).resolves.toMatchObject({
      status: "partial",
      metadata: {
        reason: "page-limit",
        fetchedPageCount: 3,
        receivedItemCount: 3,
        totalCount: 10_000,
      },
    });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("totalCount보다 수신 건수가 많으면 불일치 partial result로 구분한다", async () => {
    const request = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(
          apiResponse([guideItem("1권역"), guideItem("2권역")], 1, 100),
        ),
      );

    await expect(
      fetchRegionalDisposalGuides(
        "수원시",
        config,
        undefined,
        request,
        testPolicy,
      ),
    ).resolves.toMatchObject({
      status: "partial",
      metadata: {
        reason: "inconsistent-response",
        receivedItemCount: 2,
        totalCount: 1,
      },
    });
  });

  it("중간 페이지가 비어 있으면 추가 요청 없이 불일치 partial result로 종료한다", async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(apiResponse([guideItem("1권역")], 3, 1)),
      )
      .mockResolvedValueOnce(jsonResponse(apiResponse([], 3, 1)));

    await expect(
      fetchRegionalDisposalGuides(
        "수원시",
        config,
        undefined,
        request,
        testPolicy,
      ),
    ).resolves.toMatchObject({
      status: "partial",
      metadata: {
        reason: "inconsistent-response",
        fetchedPageCount: 2,
        receivedItemCount: 1,
        totalCount: 3,
        failedPageNo: 2,
      },
    });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("여러 페이지의 동일 row는 하나의 가이드로 유지한다", async () => {
    const request = jest.fn(() =>
      Promise.resolve(jsonResponse(apiResponse([guideItem()], 2, 1))),
    );

    await expect(
      fetchRegionalDisposalGuides(
        "수원시",
        config,
        undefined,
        request,
        testPolicy,
      ),
    ).resolves.toEqual({
      status: "success",
      guides: [expect.objectContaining({ managementZoneName: "장안구" })],
    });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("완전한 결과만 캐시하고 partial result 다음 조회는 원격 요청을 다시 실행한다", async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(apiResponse([guideItem("1권역")], 2, 1)),
      )
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce(
        jsonResponse(apiResponse([guideItem("1권역")], 2, 1)),
      )
      .mockResolvedValueOnce(
        jsonResponse(apiResponse([guideItem("2권역")], 2, 1)),
      );
    const client = createRegionalGuideApiClient(config, request, testPolicy);

    await expect(
      client.fetchRegionalDisposalGuides("수원시"),
    ).resolves.toMatchObject({ status: "partial" });
    await expect(
      client.fetchRegionalDisposalGuides("수원시"),
    ).resolves.toMatchObject({ status: "success" });
    await expect(
      client.fetchRegionalDisposalGuides("수원시"),
    ).resolves.toMatchObject({ status: "success" });
    expect(request).toHaveBeenCalledTimes(4);
  });

  it("foreground 갱신을 위해 특정 시군구의 정상 결과 캐시를 비운다", async () => {
    const request = jest
      .fn()
      .mockResolvedValue(jsonResponse(apiResponse([guideItem("1권역")], 1, 1)));
    const client = createRegionalGuideApiClient(config, request, testPolicy);

    await client.fetchRegionalDisposalGuides("수원시");
    await client.fetchRegionalDisposalGuides("수원시");
    expect(request).toHaveBeenCalledTimes(1);

    client.clearCache?.("수원시");
    await client.fetchRegionalDisposalGuides("수원시");

    expect(request).toHaveBeenCalledTimes(2);
  });

  it("환경 키가 없으면 네트워크 요청 없이 구성 오류를 반환한다", async () => {
    const request = jest.fn();

    await expect(
      fetchRegionalDisposalGuides(
        "수원시",
        createRegionalGuideApiConfig({}),
        undefined,
        request,
        testPolicy,
      ),
    ).resolves.toEqual({ status: "failure", reason: "configuration" });
    expect(request).not.toHaveBeenCalled();
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function delayedResponse(
  body: unknown,
  delayMs: number,
  signal: AbortSignal | undefined,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => resolve(jsonResponse(body)), delayMs);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeoutId);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

function apiResponse(items: unknown[], totalCount?: number, numOfRows = 100) {
  return {
    response: {
      header: { resultCode: "00" },
      body: {
        items: { item: items },
        numOfRows,
        ...(totalCount === undefined ? {} : { totalCount }),
      },
    },
  };
}

function abortError(message: string): Error {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function guideItem(managementZoneName = "장안구") {
  return {
    CTPV_NM: "경기도",
    SGG_NM: "수원시",
    MNG_ZONE_NM: managementZoneName,
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
