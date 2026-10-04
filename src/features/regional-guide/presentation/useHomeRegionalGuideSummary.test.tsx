import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useState, type PropsWithChildren } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { HomeRegionalGuideRepresentativeRepository } from '../data/homeRegionalGuideRepresentativeRepository';
import type { RegionalGuideApiClient } from '../data/regionalGuideApi';
import type { RegionalGuideFavoriteRepository } from '../data/regionalGuideFavoriteRepository';
import type { RegionalGuideLookupResult } from '../domain/RegionalDisposalGuide';
import { createRegionalGuideFavorite } from '../domain/regionalGuideFavorite';
import {
  HomeRegionalGuideRepresentativeProvider,
  useHomeRegionalGuideRepresentative,
} from './HomeRegionalGuideRepresentativeContext';
import { RegionalGuideFavoritesProvider } from './RegionalGuideFavoritesContext';
import { useHomeRegionalGuideSummary } from './useHomeRegionalGuideSummary';

describe('useHomeRegionalGuideSummary', () => {
  it('Favorite 없음과 대표 지역 없음 상태를 구분합니다', async () => {
    const client = apiClient();
    const empty = await renderHook(() => useHomeRegionalGuideSummary(true, client), {
      wrapper: wrapper([], undefined),
    });
    await waitFor(() => expect(empty.result.current.state.status).toBe('no-favorite'));
    await empty.unmount();

    const noRepresentative = await renderHook(
      () => useHomeRegionalGuideSummary(true, client),
      { wrapper: wrapper([fixture('강남구')], undefined) },
    );
    await waitFor(() =>
      expect(noRepresentative.result.current.state.status).toBe(
        'no-representative',
      ),
    );
    expect(client.fetchRegionalDisposalGuides).not.toHaveBeenCalled();
  });

  it('정상 요약 갱신 실패 시 이전 내용과 재시도를 유지합니다', async () => {
    const favorite = fixture('강남구');
    const guide = guideFixture('강남구');
    const client = apiClient(
      { status: 'success', guides: [guide] },
      { status: 'failure', reason: 'network' },
    );
    const { result } = await renderHook(
      () => useHomeRegionalGuideSummary(true, client),
      { wrapper: wrapper([favorite], favorite.targetId) },
    );
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    await act(async () => result.current.retry());

    expect(result.current.state).toMatchObject({
      status: 'ready',
      refreshError: 'network',
      isRefreshing: false,
      summary: { regionName: '서울특별시 > 강남구 > 강남구' },
    });
    expect(client.clearCache).toHaveBeenCalledWith('강남구');
  });

  it.each([
    ['not-found', { status: 'not-found' } as const],
    [
      'not-provided',
      {
        status: 'success',
        guides: [guideFixture('서초구')],
      } as const,
    ],
    [
      'failure',
      { status: 'failure', reason: 'timeout' } as const,
    ],
  ])('최초 조회의 %s 상태를 구분합니다', async (expectedStatus, response) => {
    const favorite = fixture('강남구');
    const client = apiClient(response);
    const { result } = await renderHook(
      () => useHomeRegionalGuideSummary(true, client),
      { wrapper: wrapper([favorite], favorite.targetId) },
    );

    await waitFor(() =>
      expect(result.current.state.status).toBe(expectedStatus),
    );
  });

  it('대표 지역 변경 전의 늦은 응답이 최신 요약을 덮어쓰지 않습니다', async () => {
    const first = fixture('강남구');
    const second = fixture('서초구');
    const firstRequest = deferred<RegionalGuideLookupResult>();
    const client = apiClient();
    jest.mocked(client.fetchRegionalDisposalGuides)
      .mockImplementationOnce(() => firstRequest.promise)
      .mockResolvedValueOnce({
        status: 'success',
        guides: [guideFixture('서초구')],
      });
    let storedTargetId: string | undefined = first.targetId;
    const representativeRepository: HomeRegionalGuideRepresentativeRepository = {
      load: jest.fn(async () => storedTargetId),
      save: jest.fn(async targetId => {
        storedTargetId = targetId;
      }),
    };
    const { result } = await renderHook(
      () => {
        const summary = useHomeRegionalGuideSummary(true, client);
        const representative = useHomeRegionalGuideRepresentative();
        return { ...summary, representative };
      },
      {
        wrapper: wrapper(
          [first, second],
          first.targetId,
          representativeRepository,
        ),
      },
    );
    await waitFor(() =>
      expect(client.fetchRegionalDisposalGuides).toHaveBeenCalledTimes(1),
    );

    await act(async () => {
      await result.current.representative.toggle(second.targetId);
    });
    await waitFor(() =>
      expect(client.fetchRegionalDisposalGuides).toHaveBeenCalledTimes(2),
    );
    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: 'ready',
        summary: { regionName: '서울특별시 > 서초구 > 서초구' },
      }),
    );

    await act(async () => {
      firstRequest.resolve({
        status: 'success',
        guides: [guideFixture('강남구')],
      });
      await Promise.resolve();
    });
    expect(result.current.state).toMatchObject({
      status: 'ready',
      summary: { regionName: '서울특별시 > 서초구 > 서초구' },
    });
  });

  it('앱이 foreground로 복귀하면 API 캐시를 비우고 다시 조회합니다', async () => {
    let appStateListener: ((state: AppStateStatus) => void) | undefined;
    const listenerSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, listener) => {
        appStateListener = listener;
        return { remove: jest.fn() };
      });
    const favorite = fixture('강남구');
    const success: RegionalGuideLookupResult = {
      status: 'success',
      guides: [guideFixture('강남구')],
    };
    const client = apiClient(success, success);
    const { result } = await renderHook(
      () => {
        const [active, setActive] = useState(true);
        return { ...useHomeRegionalGuideSummary(active, client), setActive };
      },
      {
        wrapper: wrapper([favorite], favorite.targetId),
      },
    );
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    await act(async () => result.current.setActive(false));

    await act(async () => {
      appStateListener?.('background');
      appStateListener?.('active');
    });

    await waitFor(() =>
      expect(client.fetchRegionalDisposalGuides).toHaveBeenCalledTimes(2),
    );
    expect(client.clearCache).toHaveBeenLastCalledWith('강남구');
    listenerSpy.mockRestore();
  });
});

function wrapper(
  favorites: readonly ReturnType<typeof fixture>[],
  targetId?: string,
  providedRepresentativeRepository?: HomeRegionalGuideRepresentativeRepository,
) {
  const favoriteRepository: RegionalGuideFavoriteRepository = {
    load: jest.fn(async () => favorites),
    save: jest.fn(async () => undefined),
  };
  const representativeRepository = providedRepresentativeRepository ?? {
    load: jest.fn(async () => targetId),
    save: jest.fn(async () => undefined),
  };
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <RegionalGuideFavoritesProvider repository={favoriteRepository}>
        <HomeRegionalGuideRepresentativeProvider
          repository={representativeRepository}
        >
          {children}
        </HomeRegionalGuideRepresentativeProvider>
      </RegionalGuideFavoritesProvider>
    );
  };
}

function apiClient(...results: RegionalGuideLookupResult[]): RegionalGuideApiClient {
  return {
    clearCache: jest.fn(),
    fetchRegionalDisposalGuides: jest.fn(async (): Promise<RegionalGuideLookupResult> =>
      results.shift() ?? { status: 'failure', reason: 'unknown' },
    ),
  };
}

function fixture(sigunguName: string) {
  return createRegionalGuideFavorite(
    selection(sigunguName),
    guideFixture(sigunguName),
    '2026-09-24T00:00:00.000Z',
  );
}

function selection(sigunguName: string) {
  const code = sigunguName === '강남구' ? '11680' : '11650';
  return {
    sido: { id: 'sido:11', level: 'sido' as const, name: '서울특별시' },
    sigungu: {
      id: `sigungu:${code}`,
      level: 'sigungu' as const,
      name: sigunguName,
      parentId: 'sido:11',
    },
  };
}

function guideFixture(sigunguName: string) {
  return {
    sidoName: '서울특별시',
    sigunguName,
    targetRegionName: sigunguName,
    schedules: [
      {
        wasteType: 'general' as const,
        disposalDays: '월, 수, 금',
        disposalStartTime: '18:00',
      },
    ],
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}
