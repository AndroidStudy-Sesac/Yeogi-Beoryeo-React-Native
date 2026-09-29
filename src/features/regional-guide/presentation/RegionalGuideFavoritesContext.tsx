import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  createRegionalGuideFavoriteRepository,
  type RegionalGuideFavoriteRepository,
} from '../data/regionalGuideFavoriteRepository';
import type { RegionalGuideFavorite } from '../domain/regionalGuideFavorite';

export type RegionalGuideFavoritesLoadState = 'loading' | 'ready' | 'error';

type RegionalGuideFavoritesContextValue = Readonly<{
  favorites: readonly RegionalGuideFavorite[];
  loadState: RegionalGuideFavoritesLoadState;
  mutationError?: string;
  retryLoad(): Promise<void>;
  clearMutationError(): void;
  isFavorite(targetId: string): boolean;
  isPending(targetId: string): boolean;
  setFavorite(
    favorite: RegionalGuideFavorite,
    shouldSave: boolean,
  ): Promise<void>;
}>;

const RegionalGuideFavoritesContext =
  createContext<RegionalGuideFavoritesContextValue | null>(null);
const defaultRepository = createRegionalGuideFavoriteRepository();

export function RegionalGuideFavoritesProvider({
  children,
  repository = defaultRepository,
}: PropsWithChildren<{ repository?: RegionalGuideFavoriteRepository }>) {
  const [favorites, setFavorites] = useState<readonly RegionalGuideFavorite[]>([]);
  const [loadState, setLoadState] =
    useState<RegionalGuideFavoritesLoadState>('loading');
  const [mutationError, setMutationError] = useState<string>();
  const [pendingCounts, setPendingCounts] = useState<ReadonlyMap<string, number>>(
    new Map(),
  );
  const mountedRef = useRef(true);
  const desiredRef = useRef<readonly RegionalGuideFavorite[]>([]);
  const persistedRef = useRef<readonly RegionalGuideFavorite[]>([]);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());
  const operationVersionRef = useRef(0);
  const loadVersionRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const retryLoad = useCallback(async () => {
    const loadVersion = ++loadVersionRef.current;
    setLoadState('loading');
    try {
      const loaded = await repository.load();
      if (!mountedRef.current || loadVersion !== loadVersionRef.current) return;
      desiredRef.current = loaded;
      persistedRef.current = loaded;
      setFavorites(loaded);
      setLoadState('ready');
    } catch {
      if (!mountedRef.current || loadVersion !== loadVersionRef.current) return;
      setLoadState('error');
    }
  }, [repository]);

  useEffect(() => {
    const loadVersion = ++loadVersionRef.current;
    void repository.load().then(
      loaded => {
        if (!mountedRef.current || loadVersion !== loadVersionRef.current) return;
        desiredRef.current = loaded;
        persistedRef.current = loaded;
        setFavorites(loaded);
        setLoadState('ready');
      },
      () => {
        if (!mountedRef.current || loadVersion !== loadVersionRef.current) return;
        setLoadState('error');
      },
    );
  }, [repository]);

  const setFavorite = useCallback(
    async (favorite: RegionalGuideFavorite, shouldSave: boolean) => {
      if (loadState !== 'ready') {
        throw new Error('Favorite 복원이 끝난 뒤 다시 시도해 주세요.');
      }

      setMutationError(undefined);
      const current = desiredRef.current;
      const next = shouldSave
        ? [
            ...current.filter(item => item.targetId !== favorite.targetId),
            favorite,
          ]
        : current.filter(item => item.targetId !== favorite.targetId);
      desiredRef.current = next;
      const operationVersion = ++operationVersionRef.current;
      setPendingCounts(counts => increment(counts, favorite.targetId));

      const write = writeChainRef.current
        .catch(() => undefined)
        .then(async () => {
          await repository.save(next);
          persistedRef.current = next;
          if (mountedRef.current && operationVersion === operationVersionRef.current) {
            setFavorites(next);
            setMutationError(undefined);
          }
        });
      writeChainRef.current = write;

      try {
        await write;
      } catch (error) {
        if (mountedRef.current) {
          if (operationVersion === operationVersionRef.current) {
            desiredRef.current = persistedRef.current;
            setFavorites(persistedRef.current);
          }
          setMutationError(
            shouldSave
              ? '지역 가이드를 저장하지 못했어요. 다시 시도해 주세요.'
              : '지역 가이드 저장 해제에 실패했어요. 다시 시도해 주세요.',
          );
        }
        throw error;
      } finally {
        if (mountedRef.current) {
          setPendingCounts(counts => decrement(counts, favorite.targetId));
        }
      }
    },
    [loadState, repository],
  );

  const value = useMemo<RegionalGuideFavoritesContextValue>(
    () => ({
      favorites,
      loadState,
      mutationError,
      retryLoad,
      clearMutationError: () => setMutationError(undefined),
      isFavorite: targetId =>
        favorites.some(favorite => favorite.targetId === targetId),
      isPending: targetId => (pendingCounts.get(targetId) ?? 0) > 0,
      setFavorite,
    }),
    [favorites, loadState, mutationError, pendingCounts, retryLoad, setFavorite],
  );

  return (
    <RegionalGuideFavoritesContext.Provider value={value}>
      {children}
    </RegionalGuideFavoritesContext.Provider>
  );
}

export function useRegionalGuideFavorites(): RegionalGuideFavoritesContextValue {
  const value = useContext(RegionalGuideFavoritesContext);
  if (value === null) {
    throw new Error('RegionalGuideFavoritesProvider 안에서 사용해야 합니다.');
  }
  return value;
}

export function useOptionalRegionalGuideFavorites(): RegionalGuideFavoritesContextValue | null {
  return useContext(RegionalGuideFavoritesContext);
}

function increment(
  counts: ReadonlyMap<string, number>,
  targetId: string,
): ReadonlyMap<string, number> {
  const next = new Map(counts);
  next.set(targetId, (next.get(targetId) ?? 0) + 1);
  return next;
}

function decrement(
  counts: ReadonlyMap<string, number>,
  targetId: string,
): ReadonlyMap<string, number> {
  const next = new Map(counts);
  const count = (next.get(targetId) ?? 1) - 1;
  if (count <= 0) next.delete(targetId);
  else next.set(targetId, count);
  return next;
}
