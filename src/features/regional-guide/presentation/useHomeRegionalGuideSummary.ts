import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  sharedRegionalGuideApiClient,
  type RegionalGuideApiClient,
} from '../data/regionalGuideApi';
import {
  buildHomeRegionalGuideSummary,
  type HomeRegionalGuideSummary,
} from '../domain/HomeRegionalGuideSummary';
import type {
  RegionalDisposalGuide,
  RegionalGuideFailureReason,
} from '../domain/RegionalDisposalGuide';
import {
  findFavoriteGuide,
  type RegionalGuideFavorite,
} from '../domain/regionalGuideFavorite';
import { formatRegionSelection } from '../domain/Region';
import { useHomeRegionalGuideRepresentative } from './HomeRegionalGuideRepresentativeContext';
import { useRegionalGuideFavorites } from './RegionalGuideFavoritesContext';

export type HomeRegionalGuideSummaryState =
  | Readonly<{ status: 'loading'; regionName?: string; targetId?: string }>
  | Readonly<{ status: 'favorites-failure' }>
  | Readonly<{ status: 'no-favorite' }>
  | Readonly<{ status: 'no-representative' }>
  | Readonly<{
      status: 'ready';
      favorite: RegionalGuideFavorite;
      guide: RegionalDisposalGuide;
      summary: HomeRegionalGuideSummary;
      isPartial: boolean;
      isRefreshing: boolean;
      refreshError?: RegionalGuideFailureReason;
    }>
  | Readonly<{
      status: 'not-found' | 'not-provided';
      favorite: RegionalGuideFavorite;
    }>
  | Readonly<{
      status: 'failure';
      favorite: RegionalGuideFavorite;
      reason: RegionalGuideFailureReason;
    }>;

type ReadySnapshot = Extract<HomeRegionalGuideSummaryState, { status: 'ready' }>;

export function useHomeRegionalGuideSummary(
  active = true,
  client: RegionalGuideApiClient = sharedRegionalGuideApiClient,
) {
  const favorites = useRegionalGuideFavorites();
  const representative = useHomeRegionalGuideRepresentative();
  const [state, setState] = useState<HomeRegionalGuideSummaryState>({
    status: 'loading',
  });
  const activeControllerRef = useRef<AbortController | undefined>(undefined);
  const readySnapshotRef = useRef<ReadySnapshot | undefined>(undefined);
  const targetIdRef = useRef<string | undefined>(undefined);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const load = useCallback(
    async (forceRefresh = false) => {
      const favorite = representative.favorite;
      const sigunguName = favorite?.selection.sigungu?.name;
      if (!favorite || !sigunguName) return;

      activeControllerRef.current?.abort();
      const controller = new AbortController();
      activeControllerRef.current = controller;
      const previous =
        readySnapshotRef.current?.favorite.targetId === favorite.targetId
          ? readySnapshotRef.current
          : undefined;

      setState(
        previous
          ? { ...previous, isRefreshing: true, refreshError: undefined }
          : {
              status: 'loading',
              targetId: favorite.targetId,
              regionName: formatRegionSelection(favorite.selection),
            },
      );
      if (forceRefresh) client.clearCache(sigunguName);

      try {
        const result = await client.fetchRegionalDisposalGuides(
          sigunguName,
          controller.signal,
        );
        if (activeControllerRef.current !== controller) return;

        if (result.status === 'not-found') {
          readySnapshotRef.current = undefined;
          setState({ status: 'not-found', favorite });
          return;
        }
        if (result.status === 'failure') {
          showFailure(result.reason, favorite, previous, setState);
          return;
        }

        const guide = findFavoriteGuide(favorite, result.guides);
        if (!guide) {
          readySnapshotRef.current = undefined;
          setState({ status: 'not-provided', favorite });
          return;
        }
        const snapshot: ReadySnapshot = {
          status: 'ready',
          favorite,
          guide,
          summary: buildHomeRegionalGuideSummary(
            guide,
            formatRegionSelection(favorite.selection),
          ),
          isPartial: result.status === 'partial',
          isRefreshing: false,
        };
        readySnapshotRef.current = snapshot;
        setState(snapshot);
      } catch (error) {
        if (
          activeControllerRef.current !== controller ||
          isAbortError(error)
        ) {
          return;
        }
        showFailure('unknown', favorite, previous, setState);
      } finally {
        if (activeControllerRef.current === controller) {
          activeControllerRef.current = undefined;
        }
      }
    },
    [client, representative.favorite],
  );

  useEffect(() => {
    const targetId = representative.favorite?.targetId;
    if (targetIdRef.current !== targetId) {
      targetIdRef.current = targetId;
      readySnapshotRef.current = undefined;
      activeControllerRef.current?.abort();
      activeControllerRef.current = undefined;
    }

    if (
      favorites.loadState === 'ready' &&
      representative.loadState === 'ready' &&
      representative.favorite &&
      active
    ) {
      void load();
    }
  }, [
    active,
    favorites.favorites.length,
    favorites.loadState,
    load,
    representative.favorite,
    representative.loadState,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if (previousState !== 'active' && nextState === 'active') {
        void load(true);
      }
    });
    return () => subscription.remove();
  }, [load]);

  useEffect(
    () => () => {
      activeControllerRef.current?.abort();
      activeControllerRef.current = undefined;
    },
    [],
  );

  const visibleState = deriveVisibleState(
    state,
    favorites.loadState,
    favorites.favorites.length,
    representative.loadState,
    representative.favorite,
  );

  return {
    state: visibleState,
    retry: useCallback(() => load(true), [load]),
  };
}

function deriveVisibleState(
  lookupState: HomeRegionalGuideSummaryState,
  favoriteLoadState: 'loading' | 'ready' | 'error',
  favoriteCount: number,
  representativeLoadState: 'loading' | 'ready',
  representative: RegionalGuideFavorite | undefined,
): HomeRegionalGuideSummaryState {
  if (favoriteLoadState === 'loading' || representativeLoadState === 'loading') {
    return { status: 'loading' };
  }
  if (favoriteLoadState === 'error') return { status: 'favorites-failure' };
  if (favoriteCount === 0) return { status: 'no-favorite' };
  if (!representative) return { status: 'no-representative' };

  const lookupTargetId =
    lookupState.status === 'loading'
      ? lookupState.targetId
      : 'favorite' in lookupState
        ? lookupState.favorite.targetId
        : undefined;
  return lookupTargetId === representative.targetId
    ? lookupState
    : {
        status: 'loading',
        targetId: representative.targetId,
        regionName: formatRegionSelection(representative.selection),
      };
}

function showFailure(
  reason: RegionalGuideFailureReason,
  favorite: RegionalGuideFavorite,
  previous: ReadySnapshot | undefined,
  setState: (state: HomeRegionalGuideSummaryState) => void,
) {
  if (previous) {
    const retained = {
      ...previous,
      isRefreshing: false,
      refreshError: reason,
    } satisfies ReadySnapshot;
    setState(retained);
    return;
  }
  setState({ status: 'failure', favorite, reason });
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
