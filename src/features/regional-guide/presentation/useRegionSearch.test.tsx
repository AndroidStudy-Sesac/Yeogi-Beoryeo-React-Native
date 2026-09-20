import { act, renderHook } from '@testing-library/react-native';

import type { RegionSearchService } from '../data/regionSearchService';
import type { RegionSearchCandidate } from '../domain/RegionSearch';
import { useRegionSearch } from './useRegionSearch';

jest.useFakeTimers();

describe('useRegionSearch', () => {
  it('입력 후 300ms가 지난 시점에만 검색합니다', async () => {
    const service = resolvedService('서울특별시 강남구');
    const { result } = await renderHook(() =>
      useRegionSearch({ service, debounceMilliseconds: 300 }),
    );

    await act(async () => result.current.setQuery('강남구'));
    await act(async () => jest.advanceTimersByTime(299));
    expect(service.search).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(service.search).toHaveBeenCalledTimes(1);
    expect(result.current.state.status).toBe('resolved');
  });

  it('새 입력은 이전 요청을 취소하고 늦은 결과를 무시합니다', async () => {
    let firstSignal: AbortSignal | undefined;
    let resolveFirst: ((result: ReturnType<typeof resolvedResult>) => void) | undefined;
    const service: RegionSearchService = {
      search: jest.fn((query, signal) => {
        if (query === '역삼동') {
          firstSignal = signal;
          return new Promise(resolve => {
            resolveFirst = resolve;
          });
        }
        return Promise.resolve(resolvedResult('강남동'));
      }),
      getStatistics: () => ({ indexBuildCount: 0, searchCount: 0 }),
    };
    const { result } = await renderHook(() => useRegionSearch({ service }));

    await act(async () => {
      void result.current.search('역삼동');
      await Promise.resolve();
    });
    await act(async () => result.current.setQuery('강남동'));
    expect(firstSignal?.aborted).toBe(true);
    await act(async () => result.current.search('강남동'));
    expect(result.current.state).toMatchObject({
      status: 'resolved',
      candidate: { displayName: '강남동' },
    });

    await act(async () => {
      resolveFirst?.(resolvedResult('오래된 결과'));
      await Promise.resolve();
    });
    expect(result.current.state).toMatchObject({
      status: 'resolved',
      candidate: { displayName: '강남동' },
    });
  });

  it('화면 이탈 시 진행 중인 검색을 취소합니다', async () => {
    let signal: AbortSignal | undefined;
    const service: RegionSearchService = {
      search: jest.fn((_query, requestSignal) => {
        signal = requestSignal;
        return new Promise(() => undefined);
      }),
      getStatistics: () => ({ indexBuildCount: 0, searchCount: 0 }),
    };
    const { result, unmount } = await renderHook(() =>
      useRegionSearch({ service }),
    );
    await act(async () => {
      void result.current.search('역삼동');
      await Promise.resolve();
    });

    await unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('새 initialQuery가 전달되면 이전 요청을 취소하고 다시 검색합니다', async () => {
    let firstSignal: AbortSignal | undefined;
    const service: RegionSearchService = {
      search: jest.fn((query, signal) => {
        if (query === '서울 강남구') {
          firstSignal = signal;
          return new Promise(() => undefined);
        }
        return Promise.resolve(resolvedResult('부산광역시 사하구'));
      }),
      getStatistics: () => ({ indexBuildCount: 0, searchCount: 0 }),
    };
    const { result, rerender } = await renderHook<
      ReturnType<typeof useRegionSearch>,
      { initialQuery: string }
    >(
      ({ initialQuery }) =>
        useRegionSearch({ service, initialQuery, debounceMilliseconds: 300 }),
      { initialProps: { initialQuery: '서울 강남구' } },
    );

    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(firstSignal?.aborted).toBe(false);

    await rerender({ initialQuery: '부산 사하구' });
    expect(firstSignal?.aborted).toBe(true);
    expect(result.current.query).toBe('부산 사하구');
    expect(result.current.state.status).toBe('idle');

    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(result.current.state).toMatchObject({
      status: 'resolved',
      candidate: { displayName: '부산광역시 사하구' },
    });
  });
});

function resolvedService(displayName: string): jest.Mocked<RegionSearchService> {
  return {
    search: jest.fn().mockResolvedValue(resolvedResult(displayName)),
    getStatistics: jest.fn(() => ({ indexBuildCount: 0, searchCount: 0 })),
  };
}

function resolvedResult(displayName: string) {
  const candidate: RegionSearchCandidate = {
    id: displayName,
    displayName,
    region: {},
  };
  return { status: 'resolved' as const, candidate };
}
