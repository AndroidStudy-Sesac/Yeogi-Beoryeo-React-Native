import { useCallback, useEffect, useRef, useState } from "react";

import type { RegionalGuideApiClient } from "../data/regionalGuideApi";
import type {
  RegionalDisposalGuide,
  RegionalGuideFailureReason,
} from "../domain/RegionalDisposalGuide";

export type RegionalGuideApiValidationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; guide: RegionalDisposalGuide }
  | { status: "not-found" }
  | { status: "failure"; reason: RegionalGuideFailureReason };

export function useRegionalGuideApiValidation(client: RegionalGuideApiClient) {
  const activeControllerRef = useRef<AbortController | undefined>(undefined);
  const [state, setState] = useState<RegionalGuideApiValidationState>({
    status: "idle",
  });

  useEffect(
    () => () => {
      activeControllerRef.current?.abort();
      activeControllerRef.current = undefined;
    },
    [],
  );

  const validate = useCallback(
    async (sigunguName: string) => {
      activeControllerRef.current?.abort();

      const controller = new AbortController();
      activeControllerRef.current = controller;
      setState({ status: "loading" });

      try {
        const result = await client.fetchRegionalDisposalGuides(
          sigunguName,
          controller.signal,
        );
        if (activeControllerRef.current !== controller) return;

        if (result.status === "success") {
          setState({ status: "success", guide: result.guides[0] });
        } else if (result.status === "not-found") {
          setState({ status: "not-found" });
        } else {
          setState({ status: "failure", reason: result.reason });
        }
      } catch (error) {
        if (activeControllerRef.current !== controller) {
          return;
        }
        if (isAbortError(error)) {
          setState({ status: "idle" });
          return;
        }

        setState({ status: "failure", reason: "unknown" });
      } finally {
        if (activeControllerRef.current === controller) {
          activeControllerRef.current = undefined;
        }
      }
    },
    [client],
  );

  const reset = useCallback(() => {
    activeControllerRef.current?.abort();
    activeControllerRef.current = undefined;
    setState({ status: "idle" });
  }, []);

  return { state, validate, reset };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
