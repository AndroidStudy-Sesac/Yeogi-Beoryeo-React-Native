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
import {
  selectGuidesForRegion,
  type RegionalGuideQuery,
} from '../domain/regionalGuideQuery';

export type RegionalGuideDetailState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'success'; guides: readonly RegionalDisposalGuide[] }>
  | Readonly<{
      status: 'partial';
      guides: readonly RegionalDisposalGuide[];
      metadata: RegionalGuidePartialResultMetadata;
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

  const lookup = useCallback(
    async (query: RegionalGuideQuery) => {
      activeControllerRef.current?.abort();
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
          setState({ status: 'not-found' });
          return;
        }
        if (result.status === 'failure') {
          setState({ status: 'failure', reason: result.reason });
          return;
        }

        const guides = selectGuidesForRegion(
          result.guides,
          query.eupmyeondongName,
        );
        if (result.status === 'partial') {
          setState({ status: 'partial', guides, metadata: result.metadata });
          return;
        }
        setState(
          guides.length > 0
            ? { status: 'success', guides }
            : { status: 'not-provided' },
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

  const retry = useCallback(() => {
    const query = lastQueryRef.current;
    return query ? lookup(query) : Promise.resolve();
  }, [lookup]);

  return { state, lookup, retry };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
