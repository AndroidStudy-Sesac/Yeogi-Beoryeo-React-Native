import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import type { RegionalGuideFavoriteRepository } from '../data/regionalGuideFavoriteRepository';
import { createRegionalGuideFavorite } from '../domain/regionalGuideFavorite';
import {
  RegionalGuideFavoritesProvider,
  useRegionalGuideFavorites,
} from './RegionalGuideFavoritesContext';

describe('RegionalGuideFavoritesProvider', () => {
  it('복원이 끝나기 전 변경을 거부해 복원된 상태를 덮어쓰지 않습니다', async () => {
    const load = deferred<readonly ReturnType<typeof fixture>[]>() ;
    const repository: RegionalGuideFavoriteRepository = {
      load: jest.fn(() => load.promise),
      save: jest.fn(async () => undefined),
    };
    const { result } = await renderHook(() => useRegionalGuideFavorites(), {
      wrapper: wrapper(repository),
    });

    await expect(result.current.setFavorite(fixture(), true)).rejects.toThrow(
      '복원이 끝난 뒤',
    );
    load.resolve([fixture()]);

    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    expect(result.current.favorites).toHaveLength(1);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('빠른 추가·해제를 순서대로 저장하고 마지막 변경만 화면에 확정합니다', async () => {
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    const save = jest
      .fn()
      .mockImplementationOnce(() => firstWrite.promise)
      .mockImplementationOnce(() => secondWrite.promise);
    const repository: RegionalGuideFavoriteRepository = {
      load: jest.fn(async () => []),
      save,
    };
    const favorite = fixture();
    const { result } = await renderHook(() => useRegionalGuideFavorites(), {
      wrapper: wrapper(repository),
    });
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    let add!: Promise<void>;
    let remove!: Promise<void>;
    await act(async () => {
      add = result.current.setFavorite(favorite, true);
      remove = result.current.setFavorite(favorite, false);
      await Promise.resolve();
    });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenNthCalledWith(1, [favorite]);

    await act(async () => {
      firstWrite.resolve();
      await add;
    });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(result.current.favorites).toEqual([]);
    expect(save).toHaveBeenNthCalledWith(2, []);

    await act(async () => {
      secondWrite.resolve();
      await remove;
    });
    expect(result.current.favorites).toEqual([]);
    expect(result.current.isPending(favorite.targetId)).toBe(false);
  });

  it('서로 다른 항목은 먼저 저장된 항목부터 화면 상태를 확정합니다', async () => {
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    const save = jest
      .fn()
      .mockImplementationOnce(() => firstWrite.promise)
      .mockImplementationOnce(() => secondWrite.promise);
    const repository: RegionalGuideFavoriteRepository = {
      load: jest.fn(async () => []),
      save,
    };
    const first = fixture('강남구');
    const second = fixture('서초구');
    const { result } = await renderHook(() => useRegionalGuideFavorites(), {
      wrapper: wrapper(repository),
    });
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    let saveFirst!: Promise<void>;
    let saveSecond!: Promise<void>;
    await act(async () => {
      saveFirst = result.current.setFavorite(first, true);
      saveSecond = result.current.setFavorite(second, true);
      await Promise.resolve();
    });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));

    await act(async () => {
      firstWrite.resolve();
      await saveFirst;
    });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(result.current.isFavorite(first.targetId)).toBe(true);
    expect(result.current.isPending(first.targetId)).toBe(false);
    expect(result.current.isFavorite(second.targetId)).toBe(false);
    expect(result.current.isPending(second.targetId)).toBe(true);

    await act(async () => {
      secondWrite.resolve();
      await saveSecond;
    });
    expect(result.current.isFavorite(second.targetId)).toBe(true);
    expect(result.current.isPending(second.targetId)).toBe(false);
  });

  it('쓰기 실패 시 마지막 정상 저장 상태를 유지하고 실패 피드백을 냅니다', async () => {
    const repository: RegionalGuideFavoriteRepository = {
      load: jest.fn(async () => []),
      save: jest.fn(async () => {
        throw new Error('disk full');
      }),
    };
    const favorite = fixture();
    const { result } = await renderHook(() => useRegionalGuideFavorites(), {
      wrapper: wrapper(repository),
    });
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    await act(async () => {
      await expect(result.current.setFavorite(favorite, true)).rejects.toThrow(
        'disk full',
      );
    });

    expect(result.current.favorites).toEqual([]);
    expect(result.current.mutationError).toContain('저장하지 못했어요');
  });

  it('이전 쓰기가 실패해도 최신 쓰기가 성공하면 오래된 실패 상태를 남기지 않습니다', async () => {
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    const repository: RegionalGuideFavoriteRepository = {
      load: jest.fn(async () => []),
      save: jest
        .fn()
        .mockImplementationOnce(() => firstWrite.promise)
        .mockImplementationOnce(() => secondWrite.promise),
    };
    const favorite = fixture();
    const { result } = await renderHook(() => useRegionalGuideFavorites(), {
      wrapper: wrapper(repository),
    });
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    let add!: Promise<void>;
    let remove!: Promise<void>;
    await act(async () => {
      add = result.current.setFavorite(favorite, true);
      remove = result.current.setFavorite(favorite, false);
      await Promise.resolve();
    });
    await act(async () => {
      firstWrite.reject(new Error('first write failed'));
      await expect(add).rejects.toThrow('first write failed');
    });
    expect(result.current.mutationError).toContain('저장하지 못했어요');

    await act(async () => {
      secondWrite.resolve();
      await remove;
    });

    expect(result.current.favorites).toEqual([]);
    expect(result.current.mutationError).toBeUndefined();
  });
});

function wrapper(repository: RegionalGuideFavoriteRepository) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <RegionalGuideFavoritesProvider repository={repository}>
        {children}
      </RegionalGuideFavoritesProvider>
    );
  };
}

function fixture(targetRegionName = '강남구') {
  return createRegionalGuideFavorite(
    {
      sido: { id: 'sido:11', level: 'sido', name: '서울특별시' },
      sigungu: {
        id: 'sigungu:11680',
        level: 'sigungu',
        name: '강남구',
        parentId: 'sido:11',
      },
    },
    { targetRegionName, schedules: [] },
    '2026-09-24T00:00:00.000Z',
  );
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}
