import { act, renderHook } from '@testing-library/react-native';

import type { RegionalGuideApiClient } from '../data/regionalGuideApi';
import type { RegionalGuideLookupResult } from '../domain/RegionalDisposalGuide';
import { useRegionalGuideDetail } from './useRegionalGuideDetail';

describe('useRegionalGuideDetail', () => {
  it('후속 페이지 실패에서 받은 정상 안내를 partial 상태로 유지합니다', async () => {
    const client = clientReturning({
      status: 'partial',
      guides: [{ targetRegionName: '노형동', schedules: [] }],
      metadata: {
        reason: 'network',
        fetchedPageCount: 1,
        receivedItemCount: 1,
        totalCount: 2,
        failedPageNo: 2,
        duplicateGuideCount: 0,
      },
    });
    const { result } = await renderHook(() => useRegionalGuideDetail(client));

    await act(() =>
      result.current.lookup({
        sigunguName: '제주시',
        eupmyeondongName: '노형동',
      }),
    );

    expect(result.current.state).toMatchObject({
      status: 'partial',
      guides: [{ targetRegionName: '노형동' }],
      metadata: { reason: 'network', failedPageNo: 2 },
    });
  });

  it('완전한 시군구 결과에 선택 읍면동 안내가 없으면 미제공으로 구분합니다', async () => {
    const client = clientReturning({
      status: 'success',
      guides: [{ targetRegionName: '이도동', schedules: [] }],
    });
    const { result } = await renderHook(() => useRegionalGuideDetail(client));

    await act(() =>
      result.current.lookup({
        sigunguName: '제주시',
        eupmyeondongName: '노형동',
      }),
    );

    expect(result.current.state).toEqual({ status: 'not-provided' });
  });

  it('정확히 일치하는 안내가 여러 건이면 후보 선택 후 단일 상세로 전환합니다', async () => {
    const firstGuide = {
      managementZoneName: '1권역',
      targetRegionName: '노형동',
      schedules: [],
    };
    const secondGuide = {
      managementZoneName: '2권역',
      targetRegionName: '노형동',
      schedules: [],
    };
    const client = clientReturning({
      status: 'success',
      guides: [firstGuide, secondGuide],
    });
    const { result } = await renderHook(() => useRegionalGuideDetail(client));

    await act(() =>
      result.current.lookup({
        sigunguName: '제주시',
        eupmyeondongName: '노형동',
      }),
    );
    expect(result.current.state).toMatchObject({
      status: 'candidates',
      reason: 'multiple-exact-matches',
    });

    await act(async () => result.current.selectCandidate(secondGuide));

    expect(result.current.state).toEqual({
      status: 'success',
      guides: [secondGuide],
    });
  });

  it('부분 조회의 복수 후보를 선택해도 partial 진단 정보를 유지합니다', async () => {
    const firstGuide = {
      managementZoneName: '1권역',
      targetRegionName: '노형동',
      schedules: [],
    };
    const secondGuide = {
      managementZoneName: '2권역',
      targetRegionName: '노형동',
      schedules: [],
    };
    const metadata = {
      reason: 'timeout' as const,
      fetchedPageCount: 1,
      receivedItemCount: 2,
      totalCount: 3,
      failedPageNo: 2,
      duplicateGuideCount: 0,
    };
    const client = clientReturning({
      status: 'partial',
      guides: [firstGuide, secondGuide],
      metadata,
    });
    const { result } = await renderHook(() => useRegionalGuideDetail(client));

    await act(() =>
      result.current.lookup({
        sigunguName: '제주시',
        eupmyeondongName: '노형동',
      }),
    );
    expect(result.current.state).toMatchObject({
      status: 'candidates',
      partialMetadata: metadata,
    });

    await act(async () => result.current.selectCandidate(firstGuide));

    expect(result.current.state).toEqual({
      status: 'partial',
      guides: [firstGuide],
      metadata,
    });
  });

  it('후보 상세에서 뒤로가면 부분 조회 정보를 포함한 후보 목록을 복원합니다', async () => {
    const firstGuide = {
      managementZoneName: '1권역',
      targetRegionName: '노형동',
      schedules: [],
    };
    const secondGuide = {
      managementZoneName: '2권역',
      targetRegionName: '노형동',
      schedules: [],
    };
    const metadata = {
      reason: 'timeout' as const,
      fetchedPageCount: 1,
      receivedItemCount: 2,
      totalCount: 3,
      failedPageNo: 2,
      duplicateGuideCount: 0,
    };
    const client = clientReturning({
      status: 'partial',
      guides: [firstGuide, secondGuide],
      metadata,
    });
    const { result } = await renderHook(() => useRegionalGuideDetail(client));

    await act(() =>
      result.current.lookup({
        sigunguName: '제주시',
        eupmyeondongName: '노형동',
      }),
    );
    await act(async () => result.current.selectCandidate(firstGuide));
    expect(result.current.canRestoreCandidates).toBe(true);

    await act(async () => result.current.restoreCandidates());

    expect(result.current.state).toEqual({
      status: 'candidates',
      guides: [firstGuide, secondGuide],
      reason: 'multiple-exact-matches',
      partialMetadata: metadata,
    });
    expect(result.current.canRestoreCandidates).toBe(false);
  });

  it('오래된 요청의 늦은 결과가 최신 지역 결과를 덮어쓰지 않습니다', async () => {
    const first = deferredResult();
    const client: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest.fn(sigunguName =>
        sigunguName === '제주시'
          ? first.promise
          : Promise.resolve({
              status: 'success',
              guides: [{ sigunguName: '서귀포시', schedules: [] }],
            }),
      ),
      clearCache: jest.fn(),
    };
    const { result } = await renderHook(() => useRegionalGuideDetail(client));

    await act(async () => {
      void result.current.lookup({ sigunguName: '제주시' });
      await Promise.resolve();
    });
    await act(async () => result.current.lookup({ sigunguName: '서귀포시' }));
    await act(async () => {
      first.resolve({
        status: 'success',
        guides: [{ sigunguName: '제주시', schedules: [] }],
      });
      await first.promise;
    });

    expect(result.current.state).toEqual({
      status: 'success',
      guides: [{ sigunguName: '서귀포시', schedules: [] }],
    });
  });

  it('실패 후 마지막 조건으로 재시도해 정상 상태로 복구합니다', async () => {
    const client: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest
        .fn()
        .mockResolvedValueOnce({ status: 'failure', reason: 'timeout' })
        .mockResolvedValueOnce({
          status: 'success',
          guides: [{ sigunguName: '제주시', schedules: [] }],
        }),
      clearCache: jest.fn(),
    };
    const { result } = await renderHook(() => useRegionalGuideDetail(client));

    await act(() => result.current.lookup({ sigunguName: '제주시' }));
    expect(result.current.state).toEqual({
      status: 'failure',
      reason: 'timeout',
    });
    await act(() => result.current.retry());

    expect(result.current.state.status).toBe('success');
    expect(client.fetchRegionalDisposalGuides).toHaveBeenCalledTimes(2);
  });

  it('후보 상세 재조회가 성공하면 이전 후보 이력을 폐기합니다', async () => {
    const firstGuide = guide('1권역');
    const secondGuide = guide('2권역');
    const thirdGuide = guide('3권역');
    const client: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest
        .fn()
        .mockResolvedValueOnce({
          status: 'partial',
          guides: [firstGuide, secondGuide],
          metadata: partialMetadata(),
        })
        .mockResolvedValueOnce({
          status: 'success',
          guides: [firstGuide, secondGuide, thirdGuide],
        }),
      clearCache: jest.fn(),
    };
    const { result } = await renderHook(() => useRegionalGuideDetail(client));

    await act(() =>
      result.current.lookup({
        sigunguName: '제주시',
        eupmyeondongName: '노형동',
      }),
    );
    await act(async () => result.current.selectCandidate(firstGuide));
    await act(() => result.current.retry());

    expect(result.current.state).toMatchObject({
      status: 'candidates',
      guides: [firstGuide, secondGuide, thirdGuide],
    });
    expect(result.current.canRestoreCandidates).toBe(false);
    expect(result.current.restoreCandidates()).toBe(false);
  });

  it('재조회 중 후보 복원 시 진행 중인 요청을 취소하고 늦은 결과를 무시합니다', async () => {
    const firstGuide = guide('1권역');
    const secondGuide = guide('2권역');
    const retryResult = deferredResult();
    let retrySignal: AbortSignal | undefined;
    const client: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest
        .fn()
        .mockResolvedValueOnce({
          status: 'partial',
          guides: [firstGuide, secondGuide],
          metadata: partialMetadata(),
        })
        .mockImplementationOnce((_sigunguName, signal) => {
          retrySignal = signal;
          return retryResult.promise;
        }),
      clearCache: jest.fn(),
    };
    const { result } = await renderHook(() => useRegionalGuideDetail(client));

    await act(() =>
      result.current.lookup({
        sigunguName: '제주시',
        eupmyeondongName: '노형동',
      }),
    );
    await act(async () => result.current.selectCandidate(firstGuide));
    await act(async () => {
      void result.current.retry();
      await Promise.resolve();
    });
    await act(async () => result.current.restoreCandidates());

    expect(retrySignal?.aborted).toBe(true);
    expect(result.current.state).toMatchObject({
      status: 'candidates',
      guides: [firstGuide, secondGuide],
    });

    await act(async () => {
      retryResult.resolve({
        status: 'success',
        guides: [guide('새 권역')],
      });
      await retryResult.promise;
    });
    expect(result.current.state).toMatchObject({
      status: 'candidates',
      guides: [firstGuide, secondGuide],
    });
  });
});

function guide(managementZoneName: string) {
  return {
    managementZoneName,
    targetRegionName: '노형동',
    schedules: [],
  };
}

function partialMetadata() {
  return {
    reason: 'timeout' as const,
    fetchedPageCount: 1,
    receivedItemCount: 2,
    totalCount: 3,
    failedPageNo: 2,
    duplicateGuideCount: 0,
  };
}

function clientReturning(
  result: RegionalGuideLookupResult,
): RegionalGuideApiClient {
  return {
    fetchRegionalDisposalGuides: jest.fn().mockResolvedValue(result),
    clearCache: jest.fn(),
  };
}

function deferredResult() {
  let resolve!: (result: RegionalGuideLookupResult) => void;
  const promise = new Promise<RegionalGuideLookupResult>(promiseResolve => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}
