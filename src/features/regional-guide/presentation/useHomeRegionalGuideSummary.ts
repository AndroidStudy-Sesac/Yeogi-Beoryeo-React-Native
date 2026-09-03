import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import type { RegionalGuideApiClient } from "../data/regionalGuideApi";
import {
  regionalGuideSelectionPath,
  resolveRegionalGuideSelection,
} from "../data/regionalGuideSelection";
import {
  toHomeRegionalGuideSummary,
  type HomeRegionalGuideSummary,
} from "../domain/HomeRegionalGuideSummary";
import type {
  RegionalDisposalGuide,
  RegionalGuideFailureReason,
} from "../domain/RegionalDisposalGuide";
import type { RegionalGuideId } from "../domain/RegionalGuideFavorite";
import { selectGuideForRegion } from "./useRegionalGuideApiValidation";

export type HomeRegionalGuideSummaryState =
  | { status: "no-representative" }
  | { status: "loading"; guideId: RegionalGuideId }
  | {
      status: "ready";
      guideId: RegionalGuideId;
      summary: HomeRegionalGuideSummary;
      guide: RegionalDisposalGuide;
      isRefreshing: boolean;
      isPartial: boolean;
      refreshError?: RegionalGuideFailureReason;
    }
  | { status: "not-found"; guideId: RegionalGuideId }
  | { status: "not-provided"; guideId: RegionalGuideId }
  | {
      status: "failure";
      guideId: RegionalGuideId;
      reason: RegionalGuideFailureReason;
    };

interface ReadySnapshot {
  guideId: RegionalGuideId;
  summary: HomeRegionalGuideSummary;
  guide: RegionalDisposalGuide;
  isPartial: boolean;
}

export function useHomeRegionalGuideSummary(
  guideId: RegionalGuideId | undefined,
  client: RegionalGuideApiClient,
  active = true,
) {
  const [state, setState] = useState<HomeRegionalGuideSummaryState>({
    status: "no-representative",
  });
  const activeControllerRef = useRef<AbortController | undefined>(undefined);
  const readySnapshotRef = useRef<ReadySnapshot | undefined>(undefined);
  const guideIdRef = useRef<RegionalGuideId | undefined>(undefined);

  const load = useCallback(
    async (forceRefresh = false) => {
      if (!guideId || !active) return;

      const selection = resolveRegionalGuideSelection(guideId);
      if (!selection?.sigungu) {
        readySnapshotRef.current = undefined;
        setState({ status: "no-representative" });
        return;
      }

      activeControllerRef.current?.abort();
      const controller = new AbortController();
      activeControllerRef.current = controller;
      const previous =
        readySnapshotRef.current?.guideId === guideId
          ? readySnapshotRef.current
          : undefined;

      setState(
        previous
          ? {
              status: "ready",
              ...previous,
              isRefreshing: true,
            }
          : { status: "loading", guideId },
      );

      if (forceRefresh) client.clearCache?.(selection.sigungu.name);

      try {
        const result = await client.fetchRegionalDisposalGuides(
          selection.sigungu.name,
          controller.signal,
        );
        if (activeControllerRef.current !== controller) return;

        if (result.status === "success" || result.status === "partial") {
          const guide = selectGuideForRegion(
            result.guides,
            selection.eupmyeondong?.name,
          );
          if (!guide) {
            readySnapshotRef.current = undefined;
            setState({ status: "not-provided", guideId });
            return;
          }

          const snapshot: ReadySnapshot = {
            guideId,
            guide,
            summary: toHomeRegionalGuideSummary(
              guide,
              regionalGuideSelectionPath(selection),
            ),
            isPartial: result.status === "partial",
          };
          readySnapshotRef.current = snapshot;
          setState({ status: "ready", ...snapshot, isRefreshing: false });
          return;
        }

        if (result.status === "not-found") {
          readySnapshotRef.current = undefined;
          setState({ status: "not-found", guideId });
          return;
        }

        showFailure(result.reason, guideId, previous, setState);
      } catch (error) {
        if (activeControllerRef.current !== controller || isAbortError(error)) {
          return;
        }
        showFailure("unknown", guideId, previous, setState);
      } finally {
        if (activeControllerRef.current === controller) {
          activeControllerRef.current = undefined;
        }
      }
    },
    [active, client, guideId],
  );

  useEffect(() => {
    if (guideIdRef.current !== guideId) {
      guideIdRef.current = guideId;
      readySnapshotRef.current = undefined;
      activeControllerRef.current?.abort();
      activeControllerRef.current = undefined;
      setState(
        guideId
          ? { status: "loading", guideId }
          : { status: "no-representative" },
      );
    }

    if (guideId && active) void load();
  }, [active, guideId, load]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (active && nextState === "active") void load(true);
    });
    return () => subscription.remove();
  }, [active, load]);

  useEffect(
    () => () => {
      activeControllerRef.current?.abort();
      activeControllerRef.current = undefined;
    },
    [],
  );

  const retry = useCallback(() => load(true), [load]);

  return { state, retry };
}

function showFailure(
  reason: RegionalGuideFailureReason,
  guideId: RegionalGuideId,
  previous: ReadySnapshot | undefined,
  setState: (state: HomeRegionalGuideSummaryState) => void,
) {
  setState(
    previous
      ? {
          status: "ready",
          ...previous,
          isRefreshing: false,
          refreshError: reason,
        }
      : { status: "failure", guideId, reason },
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
