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
});

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
