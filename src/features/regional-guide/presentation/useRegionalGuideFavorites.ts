import { useCallback, useEffect, useRef, useState } from "react";

import type { RegionalGuideFavoriteRepository } from "../data/regionalGuideFavoriteRepository";
import type { RegionalGuideId } from "../domain/RegionalGuideFavorite";

export type RegionalGuideFavoriteState =
  | { status: "restoring"; guideIds: RegionalGuideId[] }
  | {
      status: "ready";
      guideIds: RegionalGuideId[];
      persistenceError?: "read" | "write";
    };

export function useRegionalGuideFavorites(
  repository: RegionalGuideFavoriteRepository,
) {
  const [state, setState] = useState<RegionalGuideFavoriteState>({
    status: "restoring",
    guideIds: [],
  });
  const guideIdsRef = useRef<RegionalGuideId[]>([]);
  const lastPersistedGuideIdsRef = useRef<RegionalGuideId[]>([]);
  const writeQueueRef = useRef(Promise.resolve());
  const latestWriteRevisionRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    void repository
      .restore()
      .then((guideIds) => {
        if (!mountedRef.current) return;
        guideIdsRef.current = guideIds;
        lastPersistedGuideIdsRef.current = guideIds;
        setState({ status: "ready", guideIds });
      })
      .catch(() => {
        if (!mountedRef.current) return;
        guideIdsRef.current = [];
        lastPersistedGuideIdsRef.current = [];
        setState({
          status: "ready",
          guideIds: [],
          persistenceError: "read",
        });
      });

    return () => {
      mountedRef.current = false;
    };
  }, [repository]);

  const toggle = useCallback(
    (guideId: RegionalGuideId) => {
      if (state.status !== "ready") return;

      const currentGuideIds = guideIdsRef.current;
      const nextGuideIds = currentGuideIds.includes(guideId)
        ? currentGuideIds.filter((storedGuideId) => storedGuideId !== guideId)
        : [...currentGuideIds, guideId];
      const revision = latestWriteRevisionRef.current + 1;
      latestWriteRevisionRef.current = revision;
      guideIdsRef.current = nextGuideIds;
      setState({ status: "ready", guideIds: nextGuideIds });

      writeQueueRef.current = writeQueueRef.current
        .catch(() => undefined)
        .then(() => repository.save(nextGuideIds))
        .then(() => {
          lastPersistedGuideIdsRef.current = nextGuideIds;
        })
        .catch(() => {
          if (
            mountedRef.current &&
            latestWriteRevisionRef.current === revision
          ) {
            const persistedGuideIds = lastPersistedGuideIdsRef.current;
            guideIdsRef.current = persistedGuideIds;
            setState({
              status: "ready",
              guideIds: persistedGuideIds,
              persistenceError: "write",
            });
          }
        });
    },
    [repository, state.status],
  );

  const isFavorite = useCallback(
    (guideId: RegionalGuideId) => state.guideIds.includes(guideId),
    [state.guideIds],
  );

  return { state, toggle, isFavorite };
}
