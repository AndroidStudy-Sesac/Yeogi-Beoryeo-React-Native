import {
  createRegionalGuideApiClient,
  fetchRegionalDisposalGuides,
  mapRegionalGuideItem,
  type RegionalGuideRecoveryPolicy,
} from './regionalGuideApi';

const config = { endpoint: 'https://example.com/regional-guide/info' };
const policy: RegionalGuideRecoveryPolicy = {
  pageTimeoutMs: 100,
  totalTimeoutMs: 500,
  maxPageCount: 5,
};

describe('지역 가이드 API', () => {
  afterEach(() => jest.useRealTimers());

  it('BFF에 조회 조건만 전달하고 비밀 key는 포함하지 않습니다', async () => {
    const request = jest
      .fn()
      .mockResolvedValue(jsonResponse(apiResponse([guideItem()], 1)));

    await fetchRegionalDisposalGuides(
      '수원시',
      config,
      undefined,
      request,
      policy,
    );

    const url = new URL(request.mock.calls[0][0] as string);
    expect(url.searchParams.get('sigunguName')).toBe('수원시');
    expect(url.searchParams.get('pageNo')).toBe('1');
    expect(url.searchParams.get('numOfRows')).toBe('100');
    expect(url.searchParams.has('serviceKey')).toBe(false);
    expect(request.mock.calls[0][1]).toMatchObject({
      signal: expect.any(AbortSignal),
    });
  });

  it('세 폐기물 유형의 요일·시간·방법·장소를 공통 모델로 변환합니다', () => {
    expect(mapRegionalGuideItem(guideItem())).toEqual({
      sidoName: '경기도',
      sigunguName: '수원시',
      managementZoneName: '장안구',
      targetRegionName: '정자동',
      disposalPlaceType: '문전수거',
      disposalPlace: '내 집 앞',
      uncollectedDays: '일, 공휴일',
      schedules: [
        {
          wasteType: 'general',
          disposalDays: '월, 수',
          disposalStartTime: '18:00',
          disposalEndTime: '23:00',
          disposalMethod: '종량제 봉투 배출',
          disposalPlace: '내 집 앞',
        },
        {
          wasteType: 'food',
          disposalDays: '매일',
          disposalMethod: '전용 수거함 배출',
          disposalPlace: '내 집 앞',
        },
        {
          wasteType: 'recyclable',
          disposalDays: '목',
          disposalStartTime: '20:00',
          disposalPlace: '내 집 앞',
        },
      ],
      departmentName: '청소행정과',
      departmentPhoneNumber: '031-123-4567',
      sourceMetadata: {
        managementNumber: 'guide-1',
        lastModifiedPoint: '20240201120000',
        dataCriteriaDate: '20240201',
        dataUpdatedPoint: '20240202',
        dataUpdateType: '수정',
      },
    });
  });

  it('배출 방법의 반복 공백과 줄바꿈을 화면용 문장으로 정규화합니다', () => {
    expect(
      mapRegionalGuideItem({
        ...guideItem(),
        LF_WST_EMSN_MTHD: '  종량제 봉투\n  배출  ',
      })?.schedules[0]?.disposalMethod,
    ).toBe('종량제 봉투 배출');
  });

  it('여러 페이지를 순서대로 병합합니다', async () => {
    const request = jest.fn((input: string) => {
      const pageNo = Number(new URL(input).searchParams.get('pageNo'));
      return Promise.resolve(
        jsonResponse(apiResponse([guideItem(`${pageNo}권역`)], 3, 1)),
      );
    });

    await expect(
      fetchRegionalDisposalGuides(
        '수원시',
        config,
        undefined,
        request,
        policy,
      ),
    ).resolves.toMatchObject({
      status: 'success',
      guides: [
        { managementZoneName: '1권역' },
        { managementZoneName: '2권역' },
        { managementZoneName: '3권역' },
      ],
    });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['network' as const, new TypeError('Network request failed')],
    ['api' as const, new Response(null, { status: 500 })],
    [
      'api' as const,
      jsonResponse({ response: { header: { resultCode: '30' } } }),
    ],
  ])('첫 페이지 %s 오류를 전체 실패로 반환합니다', async (reason, failure) => {
    const request =
      failure instanceof Error
        ? jest.fn().mockRejectedValue(failure)
        : jest.fn().mockResolvedValue(failure);

    await expect(
      fetchRegionalDisposalGuides(
        '수원시',
        config,
        undefined,
        request,
        policy,
      ),
    ).resolves.toEqual({ status: 'failure', reason });
  });

  it('첫 페이지 timeout을 전체 실패로 반환합니다', async () => {
    jest.useFakeTimers();
    const request = jest.fn(() => new Promise<Response>(() => undefined));
    const result = fetchRegionalDisposalGuides(
      '수원시',
      config,
      undefined,
      request,
      policy,
    );

    await jest.advanceTimersByTimeAsync(policy.pageTimeoutMs);

    await expect(result).resolves.toEqual({
      status: 'failure',
      reason: 'timeout',
    });
  });

  it.each([
    ['network' as const, new TypeError('Network request failed')],
    ['api' as const, new Response(null, { status: 500 })],
  ])('후속 페이지 %s 오류를 partial로 반환합니다', async (reason, failure) => {
    const request = jest.fn();
    request.mockResolvedValueOnce(
      jsonResponse(apiResponse([guideItem('1권역')], 2, 1)),
    );
    if (failure instanceof Error) request.mockRejectedValueOnce(failure);
    else request.mockResolvedValueOnce(failure);

    await expect(
      fetchRegionalDisposalGuides(
        '수원시',
        config,
        undefined,
        request,
        policy,
      ),
    ).resolves.toMatchObject({
      status: 'partial',
      guides: [{ managementZoneName: '1권역' }],
      metadata: {
        reason,
        fetchedPageCount: 1,
        receivedItemCount: 1,
        totalCount: 2,
        failedPageNo: 2,
      },
    });
  });

  it('후속 페이지 timeout을 partial로 반환합니다', async () => {
    jest.useFakeTimers();
    const request = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(apiResponse([guideItem('1권역')], 2, 1)),
      )
      .mockImplementationOnce(() => new Promise<Response>(() => undefined));
    const result = fetchRegionalDisposalGuides(
      '수원시',
      config,
      undefined,
      request,
      policy,
    );

    await jest.advanceTimersByTimeAsync(policy.pageTimeoutMs);

    await expect(result).resolves.toMatchObject({
      status: 'partial',
      metadata: { reason: 'timeout', failedPageNo: 2 },
    });
  });

  it('전체 조회 time budget이 끝나면 받은 페이지를 partial로 유지합니다', async () => {
    jest.useFakeTimers();
    const request = jest.fn(
      (input: string, options?: { signal?: AbortSignal }) => {
        const pageNo = Number(new URL(input).searchParams.get('pageNo'));
        return delayedResponse(
          apiResponse([guideItem(`${pageNo}권역`)], 3, 1),
          40,
          options?.signal,
        );
      },
    );
    const result = fetchRegionalDisposalGuides(
      '수원시',
      config,
      undefined,
      request,
      { ...policy, pageTimeoutMs: 50, totalTimeoutMs: 90 },
    );

    await jest.advanceTimersByTimeAsync(90);

    await expect(result).resolves.toMatchObject({
      status: 'partial',
      guides: [
        { managementZoneName: '1권역' },
        { managementZoneName: '2권역' },
      ],
      metadata: { reason: 'timeout', failedPageNo: 3 },
    });
  });

  it('비정상 totalCount를 최대 페이지 상한에서 중단합니다', async () => {
    const request = jest.fn((input: string) => {
      const pageNo = Number(new URL(input).searchParams.get('pageNo'));
      return Promise.resolve(
        jsonResponse(apiResponse([guideItem(`${pageNo}권역`)], 10_000, 1)),
      );
    });

    await expect(
      fetchRegionalDisposalGuides('수원시', config, undefined, request, {
        ...policy,
        maxPageCount: 3,
      }),
    ).resolves.toMatchObject({
      status: 'partial',
      metadata: { reason: 'page-limit', fetchedPageCount: 3 },
    });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('중간 빈 페이지에서 추가 요청을 멈춥니다', async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(apiResponse([guideItem('1권역')], 3, 1)),
      )
      .mockResolvedValueOnce(jsonResponse(apiResponse([], 3, 1)));

    await expect(
      fetchRegionalDisposalGuides(
        '수원시',
        config,
        undefined,
        request,
        policy,
      ),
    ).resolves.toMatchObject({
      status: 'partial',
      metadata: { reason: 'inconsistent-response', failedPageNo: 2 },
    });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('후속 페이지의 totalCount가 바뀌면 불일치로 중단합니다', async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(apiResponse([guideItem('1권역')], 3, 1)),
      )
      .mockResolvedValueOnce(
        jsonResponse(apiResponse([guideItem('2권역')], 10, 1)),
      );

    await expect(
      fetchRegionalDisposalGuides(
        '수원시',
        config,
        undefined,
        request,
        policy,
      ),
    ).resolves.toMatchObject({
      status: 'partial',
      metadata: {
        reason: 'inconsistent-response',
        fetchedPageCount: 2,
        receivedItemCount: 1,
        failedPageNo: 2,
      },
    });
  });

  it('페이지 사이의 완전히 같은 안내는 하나로 합칩니다', async () => {
    const request = jest.fn(() =>
      Promise.resolve(jsonResponse(apiResponse([guideItem()], 2, 1))),
    );

    await expect(
      fetchRegionalDisposalGuides(
        '수원시',
        config,
        undefined,
        request,
        policy,
      ),
    ).resolves.toMatchObject({
      status: 'success',
      guides: [expect.objectContaining({ managementZoneName: '장안구' })],
    });
  });

  it('외부 cancellation은 실패나 partial로 변환하지 않습니다', async () => {
    const controller = new AbortController();
    const request = jest.fn(() => new Promise<Response>(() => undefined));
    const result = fetchRegionalDisposalGuides(
      '수원시',
      config,
      controller.signal,
      request,
      policy,
    );

    controller.abort();

    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('완전한 결과만 캐시하고 partial은 다시 조회합니다', async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(apiResponse([guideItem('1권역')], 2, 1)),
      )
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(
        jsonResponse(apiResponse([guideItem('1권역')], 1, 1)),
      );
    const client = createRegionalGuideApiClient(config, request, policy);

    await expect(
      client.fetchRegionalDisposalGuides('수원시'),
    ).resolves.toMatchObject({ status: 'partial' });
    await client.fetchRegionalDisposalGuides('수원시');
    await client.fetchRegionalDisposalGuides('수원시');

    expect(request).toHaveBeenCalledTimes(3);
  });

  it('결과 없음은 같은 시군구에서 다시 요청하지 않도록 캐시합니다', async () => {
    const request = jest
      .fn()
      .mockResolvedValue(jsonResponse(apiResponse([], 0)));
    const client = createRegionalGuideApiClient(config, request, policy);

    await client.fetchRegionalDisposalGuides('수원시');
    await client.fetchRegionalDisposalGuides('수원시');

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('endpoint가 없거나 잘못되면 요청 전에 구성 오류로 처리합니다', async () => {
    const request = jest.fn();

    await expect(
      fetchRegionalDisposalGuides('수원시', {}, undefined, request, policy),
    ).resolves.toEqual({ status: 'failure', reason: 'configuration' });
    await expect(
      fetchRegionalDisposalGuides(
        '수원시',
        { endpoint: 'secret-key' },
        undefined,
        request,
        policy,
      ),
    ).resolves.toEqual({ status: 'failure', reason: 'configuration' });
    await expect(
      fetchRegionalDisposalGuides(
        '수원시',
        { endpoint: 'https://example.com/info?serviceKey=secret' },
        undefined,
        request,
        policy,
      ),
    ).resolves.toEqual({ status: 'failure', reason: 'configuration' });
    expect(request).not.toHaveBeenCalled();
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function apiResponse(items: unknown[], totalCount: number, numOfRows = 100) {
  return {
    response: {
      header: { resultCode: '00' },
      body: { items: { item: items }, numOfRows, totalCount },
    },
  };
}

function guideItem(managementZoneName = '장안구') {
  return {
    MNG_NO: 'guide-1',
    CTPV_NM: '경기도',
    SGG_NM: '수원시',
    MNG_ZONE_NM: managementZoneName,
    MNG_ZONE_TRGT_RGN_NM: '정자동',
    EMSN_PLC_TYPE: '문전수거',
    EMSN_PLC: '내 집 앞',
    UNCLLT_DAY: '일요일/공휴일',
    LF_WST_EMSN_DOW: '월요일,수요일',
    LF_WST_EMSN_BGNG_TM: '1800',
    LF_WST_EMSN_END_TM: '2300',
    LF_WST_EMSN_MTHD: '종량제 봉투 배출',
    FOD_WST_EMSN_DOW: '매일',
    FOD_WST_EMSN_MTHD: '전용 수거함 배출',
    RCYCL_EMSN_DOW: '목요일',
    RCYCL_EMSN_BGNG_TM: '2000',
    MNG_DEPT_NM: '청소행정과',
    MNG_DEPT_TELNO: '031-123-4567',
    LAST_MDFCN_PNT: '20240201120000',
    DAT_CRTR_YMD: '20240201',
    DAT_UPDT_PNT: '20240202',
    DAT_UPDT_SE: '수정',
  };
}

function delayedResponse(
  body: unknown,
  delayMs: number,
  signal?: AbortSignal,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => resolve(jsonResponse(body)), delayMs);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeoutId);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
