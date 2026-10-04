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
  createHomeRegionalGuideRepresentativeRepository,
  type HomeRegionalGuideRepresentativeRepository,
} from '../data/homeRegionalGuideRepresentativeRepository';
import { resolveHomeRegionalGuideRepresentative } from '../domain/homeRegionalGuideRepresentative';
import type { RegionalGuideFavorite } from '../domain/regionalGuideFavorite';
import { useRegionalGuideFavorites } from './RegionalGuideFavoritesContext';

export type HomeRegionalGuideRepresentativeLoadState = 'loading' | 'ready';

type HomeRegionalGuideRepresentativeContextValue = Readonly<{
  favorite?: RegionalGuideFavorite;
  loadState: HomeRegionalGuideRepresentativeLoadState;
  mutationError?: string;
  targetId?: string;
  isPending: boolean;
  pendingTargetId?: string;
  clearMutationError(): void;
  toggle(targetId: string): Promise<void>;
}>;

const HomeRegionalGuideRepresentativeContext =
  createContext<HomeRegionalGuideRepresentativeContextValue | null>(null);
const defaultRepository = createHomeRegionalGuideRepresentativeRepository();

export function HomeRegionalGuideRepresentativeProvider({
  children,
  repository = defaultRepository,
}: PropsWithChildren<{
  repository?: HomeRegionalGuideRepresentativeRepository;
}>) {
  const favorites = useRegionalGuideFavorites();
  const [loadState, setLoadState] =
    useState<HomeRegionalGuideRepresentativeLoadState>('loading');
  const [targetId, setTargetId] = useState<string>();
  const [mutationError, setMutationError] = useState<string>();
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingTargetId, setPendingTargetId] = useState<string>();
  const mountedRef = useRef(true);
  const restoredRef = useRef(false);
  const desiredRef = useRef<string | undefined>(undefined);
  const persistedRef = useRef<string | undefined>(undefined);
  const operationVersionRef = useRef(0);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());
  const favoritesRef = useRef(favorites.favorites);

  useEffect(() => {
    favoritesRef.current = favorites.favorites;
  }, [favorites.favorites]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const persist = useCallback(
    async (nextTargetId: string | undefined, showError: boolean) => {
      const operationVersion = ++operationVersionRef.current;
      setPendingCount(count => count + 1);
      const write = writeChainRef.current
        .catch(() => undefined)
        .then(async () => {
          await repository.save(nextTargetId);
          persistedRef.current = nextTargetId;
          if (
            mountedRef.current &&
            operationVersion === operationVersionRef.current
          ) {
            setMutationError(undefined);
          }
        });
      writeChainRef.current = write;

      try {
        await write;
      } catch (error) {
        if (
          mountedRef.current &&
          operationVersion === operationVersionRef.current
        ) {
          const restored = resolveHomeRegionalGuideRepresentative(
            persistedRef.current,
            favoritesRef.current,
          )?.targetId;
          desiredRef.current = restored;
          setTargetId(restored);
          if (showError) {
            setMutationError(
              '홈 대표 지역을 변경하지 못했어요. 다시 시도해 주세요.',
            );
          }
        }
        throw error;
      } finally {
        if (mountedRef.current) {
          setPendingCount(count => Math.max(0, count - 1));
        }
      }
    },
    [repository],
  );

  useEffect(() => {
    if (restoredRef.current || favorites.loadState !== 'ready') return;
    restoredRef.current = true;
    void repository.load().then(
      storedTargetId => {
        if (!mountedRef.current) return;
        const representative = resolveHomeRegionalGuideRepresentative(
          storedTargetId,
          favoritesRef.current,
        );
        const resolvedTargetId = representative?.targetId;
        desiredRef.current = resolvedTargetId;
        persistedRef.current = storedTargetId;
        setTargetId(resolvedTargetId);
        setLoadState('ready');
        if (storedTargetId && !resolvedTargetId) {
          void persist(undefined, false).catch(() => undefined);
        }
      },
      () => {
        if (!mountedRef.current) return;
        desiredRef.current = undefined;
        persistedRef.current = undefined;
        setTargetId(undefined);
        setLoadState('ready');
      },
    );
  }, [favorites.loadState, persist, repository]);

  useEffect(() => {
    if (loadState !== 'ready' || !desiredRef.current) return;
    const representative = resolveHomeRegionalGuideRepresentative(
      desiredRef.current,
      favorites.favorites,
    );
    if (representative) return;

    desiredRef.current = undefined;
    setTargetId(undefined);
    void persist(undefined, false).catch(() => undefined);
  }, [favorites.favorites, loadState, persist]);

  const toggle = useCallback(
    async (nextTargetId: string) => {
      if (loadState !== 'ready' || favorites.loadState !== 'ready') {
        throw new Error(
          'Favorite과 대표 지역 복원이 끝난 뒤 다시 시도해 주세요.',
        );
      }
      if (!favorites.isFavorite(nextTargetId)) {
        throw new Error(
          'Favorite에 포함된 지역만 대표 지역으로 선택할 수 있습니다.',
        );
      }

      const next = desiredRef.current === nextTargetId ? undefined : nextTargetId;
      desiredRef.current = next;
      setTargetId(next);
      setMutationError(undefined);
      setPendingTargetId(nextTargetId);
      try {
        await persist(next, true);
      } finally {
        if (mountedRef.current) setPendingTargetId(undefined);
      }
    },
    [favorites, loadState, persist],
  );

  const favorite = useMemo(
    () => resolveHomeRegionalGuideRepresentative(targetId, favorites.favorites),
    [favorites.favorites, targetId],
  );
  const value = useMemo<HomeRegionalGuideRepresentativeContextValue>(
    () => ({
      favorite,
      loadState,
      mutationError,
      targetId: favorite?.targetId,
      isPending: pendingCount > 0,
      pendingTargetId,
      clearMutationError: () => setMutationError(undefined),
      toggle,
    }),
    [favorite, loadState, mutationError, pendingCount, pendingTargetId, toggle],
  );

  return (
    <HomeRegionalGuideRepresentativeContext.Provider value={value}>
      {children}
    </HomeRegionalGuideRepresentativeContext.Provider>
  );
}

export function useHomeRegionalGuideRepresentative(): HomeRegionalGuideRepresentativeContextValue {
  const value = useContext(HomeRegionalGuideRepresentativeContext);
  if (value === null) {
    throw new Error(
      'HomeRegionalGuideRepresentativeProvider 안에서 사용해야 합니다.',
    );
  }
  return value;
}
