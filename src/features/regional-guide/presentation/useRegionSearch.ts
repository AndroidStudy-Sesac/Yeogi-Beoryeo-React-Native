import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createRegionSearchService,
  type RegionSearchService,
} from '../data/regionSearchService';
import type { RegionSearchCandidate } from '../domain/RegionSearch';
import { classifyRegionSearchInput } from '../domain/regionSearchIndex';

type NonEmptyInputType = 'address' | 'region-keyword';

export type RegionSearchState =
  | Readonly<{ status: 'empty' }>
  | Readonly<{ status: 'idle' }>
  | Readonly<{
      status: 'searching';
      query: string;
      inputType: NonEmptyInputType;
    }>
  | Readonly<{
      status: 'resolved';
      query: string;
      inputType: NonEmptyInputType;
      candidate: RegionSearchCandidate;
    }>
  | Readonly<{
      status: 'candidates';
      query: string;
      inputType: NonEmptyInputType;
      candidates: readonly RegionSearchCandidate[];
    }>
  | Readonly<{ status: 'not-found'; query: string }>
  | Readonly<{ status: 'failure'; query: string }>;

type UseRegionSearchOptions = Readonly<{
  service?: RegionSearchService;
  debounceMilliseconds?: number;
  initialQuery?: string;
}>;

export function useRegionSearch({
  service: providedService,
  debounceMilliseconds = 300,
  initialQuery = '',
}: UseRegionSearchOptions = {}) {
  const defaultService = useMemo(() => createRegionSearchService(), []);
  const service = providedService ?? defaultService;
  const [query, setQueryValue] = useState(initialQuery);
  const [state, setState] = useState<RegionSearchState>(
    initialQuery.trim() ? { status: 'idle' } : { status: 'empty' },
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const requestVersionRef = useRef(0);
  const previousInitialQueryRef = useRef(initialQuery);

  const clearTimer = useCallback(() => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
  }, []);

  const invalidateActiveRequest = useCallback(() => {
    requestVersionRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = undefined;
  }, []);

  const search = useCallback(
    async (value = query) => {
      clearTimer();
      invalidateActiveRequest();
      const trimmedQuery = value.trim();
      const classifiedInput = classifyRegionSearchInput(trimmedQuery);
      if (classifiedInput === 'empty') {
        setState({ status: 'empty' });
        return;
      }

      const requestVersion = requestVersionRef.current;
      const controller = new AbortController();
      controllerRef.current = controller;
      setState({
        status: 'searching',
        query: trimmedQuery,
        inputType: classifiedInput,
      });

      try {
        const result = await service.search(trimmedQuery, controller.signal);
        if (
          controller.signal.aborted ||
          requestVersionRef.current !== requestVersion
        ) {
          return;
        }
        if (result.status === 'resolved') {
          setState({
            status: 'resolved',
            query: trimmedQuery,
            inputType: classifiedInput,
            candidate: result.candidate,
          });
        } else if (result.status === 'candidates') {
          setState({
            status: 'candidates',
            query: trimmedQuery,
            inputType: classifiedInput,
            candidates: result.candidates,
          });
        } else {
          setState({ status: 'not-found', query: trimmedQuery });
        }
      } catch (error) {
        if (
          controller.signal.aborted ||
          requestVersionRef.current !== requestVersion ||
          isAbortError(error)
        ) {
          return;
        }
        setState({ status: 'failure', query: trimmedQuery });
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = undefined;
        }
      }
    }, [clearTimer, invalidateActiveRequest, query, service]);

  useEffect(() => {
    clearTimer();
    if (!query.trim()) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = undefined;
      void search(query);
    }, debounceMilliseconds);
    return clearTimer;
  }, [clearTimer, debounceMilliseconds, query, search]);

  useEffect(
    () => () => {
      clearTimer();
      invalidateActiveRequest();
    },
    [clearTimer, invalidateActiveRequest],
  );

  const setQuery = useCallback(
    (value: string) => {
      clearTimer();
      invalidateActiveRequest();
      setQueryValue(value);
      setState(value.trim() ? { status: 'idle' } : { status: 'empty' });
    },
    [clearTimer, invalidateActiveRequest],
  );

  useEffect(() => {
    if (previousInitialQueryRef.current === initialQuery) return;
    previousInitialQueryRef.current = initialQuery;
    setQuery(initialQuery);
  }, [initialQuery, setQuery]);

  const cancel = useCallback(() => {
    clearTimer();
    invalidateActiveRequest();
    setQueryValue('');
    setState({ status: 'empty' });
  }, [clearTimer, invalidateActiveRequest]);

  const selectCandidate = useCallback(
    (candidate: RegionSearchCandidate) => {
      clearTimer();
      invalidateActiveRequest();
      const trimmedQuery = query.trim();
      const inputType = classifyRegionSearchInput(trimmedQuery);
      setState({
        status: 'resolved',
        query: trimmedQuery,
        inputType: inputType === 'address' ? 'address' : 'region-keyword',
        candidate,
      });
    },
    [clearTimer, invalidateActiveRequest, query],
  );

  const restoreCandidates = useCallback(
    (candidates: readonly RegionSearchCandidate[]) => {
      const trimmedQuery = query.trim();
      const inputType = classifyRegionSearchInput(trimmedQuery);
      setState({
        status: 'candidates',
        query: trimmedQuery,
        inputType: inputType === 'address' ? 'address' : 'region-keyword',
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
  return error instanceof Error && error.name === 'AbortError';
}
