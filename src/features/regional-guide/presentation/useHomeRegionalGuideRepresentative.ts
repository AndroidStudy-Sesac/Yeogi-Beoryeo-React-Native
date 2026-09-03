import { useCallback, useEffect, useRef, useState } from "react";

import type { HomeRegionalGuideRepresentativeRepository } from "../data/homeRegionalGuideRepresentativeRepository";
import type { RegionalGuideId } from "../domain/RegionalGuideFavorite";
import type { RegionalGuideFavoriteState } from "./useRegionalGuideFavorites";

export type HomeRegionalGuideRepresentativeState =
  | { status: "restoring"; guideId?: RegionalGuideId }
  | {
      status: "ready";
      guideId?: RegionalGuideId;
      isPersisting: boolean;
      persistenceError?: "read" | "write";
    };

export interface HomeRegionalGuideRepresentativeController {
  state: HomeRegionalGuideRepresentativeState;
  select(guideId: RegionalGuideId): void;
  clear(): void;
}

export function useHomeRegionalGuideRepresentative(
  favoriteState: RegionalGuideFavoriteState,
  repository: HomeRegionalGuideRepresentativeRepository,
): HomeRegionalGuideRepresentativeController {
  const [state, setState] = useState<HomeRegionalGuideRepresentativeState>({
    status: "restoring",
  });
  const guideIdRef = useRef<RegionalGuideId | undefined>(undefined);
  const lastPersistedGuideIdRef = useRef<RegionalGuideId | undefined>(
    undefined,
  );
  const writeQueueRef = useRef(Promise.resolve());
  const latestWriteRevisionRef = useRef(0);
  const restoredRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    restoredRef.current = false;
    guideIdRef.current = undefined;
    lastPersistedGuideIdRef.current = undefined;
    latestWriteRevisionRef.current = 0;
    setState({ status: "restoring" });

    return () => {
      mountedRef.current = false;
    };
  }, [repository]);

  useEffect(() => {
    if (
      restoredRef.current ||
      favoriteState.status !== "ready" ||
      favoriteState.isPersisting
    ) {
      return;
    }

    restoredRef.current = true;
    void repository
      .restore()
      .then((storedGuideId) => {
        if (!mountedRef.current) return;

        const guideId = resolveRepresentativeGuideId(
          storedGuideId,
          favoriteState.guideIds,
        );
        guideIdRef.current = guideId;
        lastPersistedGuideIdRef.current = storedGuideId;
        setState({
          status: "ready",
          guideId,
          isPersisting: guideId !== storedGuideId,
        });

        if (guideId !== storedGuideId) persist(guideId);
      })
      .catch(() => {
        if (!mountedRef.current) return;

        guideIdRef.current = undefined;
        setState({
          status: "ready",
          guideId: undefined,
          isPersisting: false,
          persistenceError: "read",
        });
      });
  }, [favoriteState, repository]);

  useEffect(() => {
    if (
      state.status !== "ready" ||
      favoriteState.status !== "ready" ||
      favoriteState.isPersisting
    ) {
      return;
    }

    const guideId = resolveRepresentativeGuideId(
      guideIdRef.current,
      favoriteState.guideIds,
    );
    if (guideId === guideIdRef.current) return;

    guideIdRef.current = guideId;
    setState({ status: "ready", guideId, isPersisting: true });
    persist(guideId);
  }, [favoriteState, state.status]);

  function persist(guideId: RegionalGuideId | undefined) {
    const revision = latestWriteRevisionRef.current + 1;
    latestWriteRevisionRef.current = revision;

    writeQueueRef.current = writeQueueRef.current
      .catch(() => undefined)
      .then(() => repository.save(guideId))
      .then(() => {
        lastPersistedGuideIdRef.current = guideId;
        if (mountedRef.current && latestWriteRevisionRef.current === revision) {
          setState({ status: "ready", guideId, isPersisting: false });
        }
      })
      .catch(() => {
        if (
          !mountedRef.current ||
          latestWriteRevisionRef.current !== revision
        ) {
          return;
        }

        const persistedGuideId = resolveRepresentativeGuideId(
          lastPersistedGuideIdRef.current,
          favoriteState.status === "ready" ? favoriteState.guideIds : [],
        );
        guideIdRef.current = persistedGuideId;
        setState({
          status: "ready",
          guideId: persistedGuideId,
          isPersisting: false,
          persistenceError: "write",
        });
      });
  }

  const select = useCallback(
    (guideId: RegionalGuideId) => {
      if (
        state.status !== "ready" ||
        favoriteState.status !== "ready" ||
        !favoriteState.guideIds.includes(guideId) ||
        guideId === guideIdRef.current
      ) {
        return;
      }

      guideIdRef.current = guideId;
      setState({ status: "ready", guideId, isPersisting: true });
      persist(guideId);
    },
    [favoriteState, repository, state.status],
  );

  const clear = useCallback(() => {
    if (state.status !== "ready" || !guideIdRef.current) return;

    guideIdRef.current = undefined;
    setState({ status: "ready", guideId: undefined, isPersisting: true });
    persist(undefined);
  }, [favoriteState, repository, state.status]);

  return { state, select, clear };
}

export function resolveRepresentativeGuideId(
  storedGuideId: RegionalGuideId | undefined,
  favoriteGuideIds: readonly RegionalGuideId[],
): RegionalGuideId | undefined {
  return storedGuideId && favoriteGuideIds.includes(storedGuideId)
    ? storedGuideId
    : undefined;
}
