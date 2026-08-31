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
  | { status: "not-provided" }
  | { status: "failure"; reason: RegionalGuideFailureReason };

export interface RegionalGuideLookupRequest {
  sigunguName: string;
  eupmyeondongName?: string;
}

export function useRegionalGuideApiValidation(client: RegionalGuideApiClient) {
  const activeControllerRef = useRef<AbortController | undefined>(undefined);
  const lastRequestRef = useRef<RegionalGuideLookupRequest | undefined>(
    undefined,
  );
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
    async (request: RegionalGuideLookupRequest) => {
      activeControllerRef.current?.abort();
      lastRequestRef.current = request;

      const controller = new AbortController();
      activeControllerRef.current = controller;
      setState({ status: "loading" });

      try {
        const result = await client.fetchRegionalDisposalGuides(
          request.sigunguName,
          controller.signal,
        );
        if (activeControllerRef.current !== controller) return;

        if (result.status === "success") {
          const guide = selectGuideForRegion(
            result.guides,
            request.eupmyeondongName,
          );
          setState(
            guide ? { status: "success", guide } : { status: "not-provided" },
          );
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

  const retry = useCallback(() => {
    const request = lastRequestRef.current;
    return request ? validate(request) : Promise.resolve();
  }, [validate]);

  return { state, validate, retry, reset };
}

function selectGuideForRegion(
  guides: RegionalDisposalGuide[],
  eupmyeondongName: string | undefined,
): RegionalDisposalGuide | undefined {
  if (!eupmyeondongName) return guides[0];

  return guides.find((guide) =>
    [guide.targetRegionName, guide.managementZoneName].some((regionName) =>
      regionNameMatches(regionName, eupmyeondongName),
    ),
  );
}

function regionNameMatches(
  providedRegionName: string | undefined,
  selectedRegionName: string,
): boolean {
  if (!providedRegionName) return false;

  const selectedName = normalizeRegionName(selectedRegionName);
  return providedRegionName.split(/[,+/]/).some((part) => {
    const providedName = normalizeRegionName(part);
    return (
      providedName === selectedName ||
      providedName.replace(/제(?=\d)/g, "") ===
        selectedName.replace(/제(?=\d)/g, "") ||
      ["전체", "전지역", "관내전지역"].includes(providedName) ||
      (providedName === "동지역" && selectedName.endsWith("동")) ||
      (providedName === "읍면지역" && /[읍면]$/.test(selectedName))
    );
  });
}

function normalizeRegionName(regionName: string): string {
  return regionName.replace(/\s/g, "").trim();
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
