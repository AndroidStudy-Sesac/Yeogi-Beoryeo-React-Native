import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import type { HomeRegionalGuideRepresentativeRepository } from '../data/homeRegionalGuideRepresentativeRepository';
import type { RegionalGuideFavoriteRepository } from '../data/regionalGuideFavoriteRepository';
import { createRegionalGuideFavorite } from '../domain/regionalGuideFavorite';
import {
  HomeRegionalGuideRepresentativeProvider,
  useHomeRegionalGuideRepresentative,
} from './HomeRegionalGuideRepresentativeContext';
import {
  RegionalGuideFavoritesProvider,
  useRegionalGuideFavorites,
} from './RegionalGuideFavoritesContext';

describe('HomeRegionalGuideRepresentativeProvider', () => {
  it('Favorite이 있어도 저장된 대표 지역이 없으면 자동 선택하지 않습니다', async () => {
    const favorite = fixture('강남구');
    const representativeRepository = representativeRepositoryReturning();
    const { result } = await renderHook(
      () => useHomeRegionalGuideRepresentative(),
      { wrapper: wrapper([favorite], representativeRepository) },
    );

    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    expect(result.current.targetId).toBeUndefined();
    expect(representativeRepository.save).not.toHaveBeenCalled();
  });

  it('유효한 저장값을 복원하고 같은 지역을 다시 누르면 고정을 해제합니다', async () => {
    const favorite = fixture('강남구');
    const representativeRepository = representativeRepositoryReturning(
      favorite.targetId,
    );
    const { result } = await renderHook(
      () => useHomeRegionalGuideRepresentative(),
      { wrapper: wrapper([favorite], representativeRepository) },
    );
    await waitFor(() => expect(result.current.targetId).toBe(favorite.targetId));

    await act(async () => result.current.toggle(favorite.targetId));

    expect(result.current.targetId).toBeUndefined();
    expect(representativeRepository.save).toHaveBeenLastCalledWith(undefined);
  });

  it('대표 Favorite이 해제되면 다른 Favorite으로 fallback하지 않습니다', async () => {
    const first = fixture('강남구');
    const second = fixture('서초구');
    const representativeRepository = representativeRepositoryReturning(
      first.targetId,
    );
    const { result } = await renderHook(
      () => ({
        favorites: useRegionalGuideFavorites(),
        representative: useHomeRegionalGuideRepresentative(),
      }),
      { wrapper: wrapper([first, second], representativeRepository) },
    );
    await waitFor(() =>
      expect(result.current.representative.targetId).toBe(first.targetId),
    );

    await act(async () => result.current.favorites.setFavorite(first, false));
    await waitFor(() =>
      expect(result.current.representative.targetId).toBeUndefined(),
    );

    expect(result.current.favorites.isFavorite(second.targetId)).toBe(true);
    expect(representativeRepository.save).toHaveBeenLastCalledWith(undefined);
  });
});

function wrapper(
  initialFavorites: readonly ReturnType<typeof fixture>[],
  representativeRepository: HomeRegionalGuideRepresentativeRepository,
) {
  const favoriteRepository: RegionalGuideFavoriteRepository = {
    load: jest.fn(async () => initialFavorites),
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

function representativeRepositoryReturning(
  targetId?: string,
): HomeRegionalGuideRepresentativeRepository {
  return {
    load: jest.fn(async () => targetId),
    save: jest.fn(async () => undefined),
  };
}

function fixture(sigunguName: string) {
  const code = sigunguName === '강남구' ? '11680' : '11650';
  return createRegionalGuideFavorite(
    {
      sido: { id: 'sido:11', level: 'sido', name: '서울특별시' },
      sigungu: {
        id: `sigungu:${code}`,
        level: 'sigungu',
        name: sigunguName,
        parentId: 'sido:11',
      },
    },
    { sigunguName, targetRegionName: sigunguName, schedules: [] },
    '2026-09-24T00:00:00.000Z',
  );
}
