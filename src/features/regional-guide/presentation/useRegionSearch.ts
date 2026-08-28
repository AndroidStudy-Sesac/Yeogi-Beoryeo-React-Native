import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createRegionSearchClient,
  type RegionSearchClient,
} from "../data/regionSearchClient";
import type { RegionSearchCandidate } from "../domain/RegionSearchModel";
import { classifyRegionSearchInput } from "../domain/regionSearch";

export type RegionSearchState =
  | { status: "empty" }
  | { status: "idle" }
  | {
      status: "searching";
      query: string;
      inputType: "address" | "region-keyword";
    }
  | {
      status: "resolved";
      query: string;
      inputType: "address" | "region-keyword";
      candidate: RegionSearchCandidate;
    }
  | {
      status: "candidates";
      query: string;
      inputType: "address" | "region-keyword";
      candidates: RegionSearchCandidate[];
    }
  | { status: "not-found"; query: string }
  | { status: "failure"; query: string };

export function useRegionSearch(
  providedClient?: RegionSearchClient,
  debounceMilliseconds = 300,
) {
  const defaultClient = useMemo(() => createRegionSearchClient(), []);
  const client = providedClient ?? defaultClient;
  const activeControllerRef = useRef<AbortController | undefined>(undefined);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [query, setQueryValue] = useState("");
  const [state, setState] = useState<RegionSearchState>({ status: "empty" });

  const cancelActiveRequest = useCallback(() => {
    activeControllerRef.current?.abort();
    activeControllerRef.current = undefined;
  }, []);

  const search = useCallback(
    async (searchQuery = query) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = undefined;
      }
      const trimmedQuery = searchQuery.trim();
      const inputType = classifyRegionSearchInput(trimmedQuery);
      cancelActiveRequest();

      if (inputType === "empty") {
        setState({ status: "empty" });
        return;
      }

      const controller = new AbortController();
      activeControllerRef.current = controller;
      setState({ status: "searching", query: trimmedQuery, inputType });

      try {
        const result = await client.search(trimmedQuery, controller.signal);
        if (activeControllerRef.current !== controller) return;

        if (result.status === "resolved") {
          setState({
            status: "resolved",
            query: trimmedQuery,
            inputType,
            candidate: result.candidate,
          });
        } else if (result.status === "candidates") {
          setState({
            status: "candidates",
            query: trimmedQuery,
            inputType,
            candidates: result.candidates,
          });
        } else {
          setState({ status: "not-found", query: trimmedQuery });
        }
      } catch (error) {
        if (activeControllerRef.current !== controller || isAbortError(error)) {
          return;
        }
        setState({ status: "failure", query: trimmedQuery });
      } finally {
        if (activeControllerRef.current === controller) {
          activeControllerRef.current = undefined;
        }
      }
    },
    [cancelActiveRequest, client, query],
  );

  useEffect(() => {
    if (!query.trim()) {
      cancelActiveRequest();
      setState({ status: "empty" });
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = undefined;
      void search(query);
    }, debounceMilliseconds);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = undefined;
      }
    };
  }, [cancelActiveRequest, debounceMilliseconds, query, search]);

  useEffect(() => cancelActiveRequest, [cancelActiveRequest]);

  const setQuery = useCallback(
    (value: string) => {
      cancelActiveRequest();
      setQueryValue(value);
      setState(value.trim() ? { status: "idle" } : { status: "empty" });
    },
    [cancelActiveRequest],
  );

  const cancel = useCallback(() => {
    cancelActiveRequest();
    setQueryValue("");
    setState({ status: "empty" });
  }, [cancelActiveRequest]);

  const selectCandidate = useCallback(
    (candidate: RegionSearchCandidate) => {
      cancelActiveRequest();
      setState({
        status: "resolved",
        query: query.trim(),
        inputType:
          classifyRegionSearchInput(query) === "address"
            ? "address"
            : "region-keyword",
        candidate,
      });
    },
    [cancelActiveRequest, query],
  );

  const restoreCandidates = useCallback(
    (candidates: RegionSearchCandidate[]) => {
      const trimmedQuery = query.trim();
      setState({
        status: "candidates",
        query: trimmedQuery,
        inputType:
          classifyRegionSearchInput(trimmedQuery) === "address"
            ? "address"
            : "region-keyword",
        candidates,
      });
    },
    [query],
  );

  return {
    query,
    state,
    setQuery,
    search,
    cancel,
    selectCandidate,
    restoreCandidates,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
