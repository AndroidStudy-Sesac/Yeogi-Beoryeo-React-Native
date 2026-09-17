import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createRegionalGuideApiClient,
  type RegionalGuideApiClient,
} from '../data/regionalGuideApi';
import type {
  RegionalDisposalGuide,
  RegionalGuideFailureReason,
  RegionalGuidePartialResultMetadata,
} from '../domain/RegionalDisposalGuide';
import type { RegionalGuideQuery } from '../domain/regionalGuideQuery';
import {
  selectRegionalGuideCandidate,
  type RegionalGuideCandidateReason,
} from '../domain/selectRegionalGuideCandidate';

export type RegionalGuideDetailState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'success'; guides: readonly RegionalDisposalGuide[] }>
  | Readonly<{
      status: 'partial';
      guides: readonly RegionalDisposalGuide[];
      metadata: RegionalGuidePartialResultMetadata;
    }>
  | Readonly<{
      status: 'candidates';
      guides: readonly RegionalDisposalGuide[];
      reason: RegionalGuideCandidateReason;
      partialMetadata?: RegionalGuidePartialResultMetadata;
    }>
  | Readonly<{ status: 'not-found' }>
  | Readonly<{ status: 'not-provided' }>
  | Readonly<{ status: 'failure'; reason: RegionalGuideFailureReason }>;

const defaultClient = createRegionalGuideApiClient();

export function useRegionalGuideDetail(
  providedClient: RegionalGuideApiClient | undefined,
) {
  const client = providedClient ?? defaultClient;
  const activeControllerRef = useRef<AbortController | undefined>(undefined);
  const [candidateHistory, setCandidateHistory] = useState<
    Extract<RegionalGuideDetailState, { status: 'candidates' }> | undefined
  >(undefined);
  const lastQueryRef = useRef<RegionalGuideQuery | undefined>(undefined);
  const [state, setState] = useState<RegionalGuideDetailState>({
    status: 'idle',
  });

  useEffect(
    () => () => {
      activeControllerRef.current?.abort();
      activeControllerRef.current = undefined;
    },
    [],
  );

  const performLookup = useCallback(
    async (query: RegionalGuideQuery, preserveCandidateHistory: boolean) => {
      activeControllerRef.current?.abort();
      if (!preserveCandidateHistory) setCandidateHistory(undefined);
      lastQueryRef.current = query;

      const controller = new AbortController();
      activeControllerRef.current = controller;
      setState({ status: 'loading' });

      try {
        const result = await client.fetchRegionalDisposalGuides(
          query.sigunguName,
          controller.signal,
        );
        if (activeControllerRef.current !== controller) return;

        if (result.status === 'not-found') {
          setCandidateHistory(undefined);
          setState({ status: 'not-found' });
          return;
        }
        if (result.status === 'failure') {
          setState({ status: 'failure', reason: result.reason });
          return;
        }

        setCandidateHistory(undefined);
        const selection = selectRegionalGuideCandidate(result.guides, query);
        if (selection.status === 'candidates') {
          setState({
            ...selection,
            ...(result.status === 'partial'
              ? { partialMetadata: result.metadata }
              : {}),
          });
          return;
        }
        if (selection.status === 'not-provided') {
          setState(
            result.status === 'partial'
              ? { status: 'partial', guides: [], metadata: result.metadata }
              : selection,
          );
          return;
        }
        setState(
          result.status === 'partial'
            ? {
                status: 'partial',
                guides: [selection.guide],
                metadata: result.metadata,
              }
            : { status: 'success', guides: [selection.guide] },
        );
      } catch (error) {
        if (activeControllerRef.current !== controller) return;
        if (isAbortError(error)) {
          setState({ status: 'idle' });
          return;
        }
        setState({ status: 'failure', reason: 'unknown' });
      } finally {
        if (activeControllerRef.current === controller) {
          activeControllerRef.current = undefined;
        }
      }
    },
    [client],
  );

  const lookup = useCallback(
    (query: RegionalGuideQuery) => performLookup(query, false),
    [performLookup],
  );

  const retry = useCallback(() => {
    const query = lastQueryRef.current;
    return query ? performLookup(query, true) : Promise.resolve();
  }, [performLookup]);

  const selectCandidate = useCallback(
    (guide: RegionalDisposalGuide) => {
      if (state.status !== 'candidates' || !state.guides.includes(guide)) {
        return;
      }
      setCandidateHistory(state);
      setState(
        state.partialMetadata
          ? {
              status: 'partial',
              guides: [guide],
              metadata: state.partialMetadata,
            }
          : { status: 'success', guides: [guide] },
      );
    },
    [state],
  );

  const restoreCandidates = useCallback(() => {
    const candidates = candidateHistory;
    if (!candidates) return false;

    activeControllerRef.current?.abort();
    activeControllerRef.current = undefined;
    setCandidateHistory(undefined);
    setState(candidates);
    return true;
  }, [candidateHistory]);

  return {
    state,
    lookup,
    retry,
    selectCandidate,
    restoreCandidates,
    canRestoreCandidates: candidateHistory !== undefined,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
