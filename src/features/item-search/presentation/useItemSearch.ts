import { useCallback, useEffect, useRef, useState } from 'react';

import { loadItemCatalog } from '../data/itemCatalog';
import type { ItemGuide } from '../domain/itemGuide';

export type ItemSearchSnapshot = {
  query: string;
  submittedQuery: string | null;
  handledInitialQuery: string | null;
  resultVersion: number;
  scrollOffset: number;
};

type SearchState = ItemSearchSnapshot & {
  status: 'idle' | 'loading' | 'success' | 'empty' | 'error';
  guides: readonly ItemGuide[];
};

export type SearchItems = (
  query: string,
  signal: AbortSignal,
) => Promise<readonly ItemGuide[]>;

const searchBundledItems: SearchItems = async query =>
  loadItemCatalog().search(query);

const emptySnapshot: ItemSearchSnapshot = {
  query: '',
  submittedQuery: null,
  handledInitialQuery: null,
  resultVersion: 0,
  scrollOffset: 0,
};

export function useItemSearch({
  initialQuery,
  savedState,
  onSnapshot,
  searchItems = searchBundledItems,
}: {
  initialQuery?: string;
  savedState?: ItemSearchSnapshot;
  onSnapshot?: (snapshot: ItemSearchSnapshot) => void;
  searchItems?: SearchItems;
} = {}) {
  const initial = useRef(savedState ?? emptySnapshot);
  const [state, setState] = useState<SearchState>(() => {
    const snapshot = savedState ?? emptySnapshot;
    return { ...snapshot, status: snapshot.submittedQuery === null ? 'idle' : 'loading', guides: [] };
  });
  const current = useRef(state);
  const request = useRef<AbortController | null>(null);

  const publish = useCallback((next: SearchState) => {
    current.current = next;
    setState(next);
  }, []);

  const cancel = useCallback(() => {
    request.current?.abort();
    request.current = null;
  }, []);

  const startSearch = useCallback((
    query: string,
    inputQuery: string,
    restoring = false,
  ) => {
    if (request.current && current.current.status === 'loading' &&
      current.current.submittedQuery === query) return;

    cancel();
    const controller = new AbortController();
    request.current = controller;
    publish({
      ...current.current,
      query: inputQuery,
      submittedQuery: query,
      guides: [],
      status: 'loading',
    });

    // Defer catalog initialization so synchronous failures use the retry state.
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return [];
      return searchItems(query, controller.signal);
    }).then(guides => {
      if (controller.signal.aborted || request.current !== controller) return;
      request.current = null;
      publish({
        ...current.current,
        guides,
        status: guides.length === 0 ? 'empty' : 'success',
        resultVersion: current.current.resultVersion + (restoring ? 0 : 1),
        scrollOffset: !restoring && guides.length > 0 ? 0 : current.current.scrollOffset,
      });
    }, () => {
      if (controller.signal.aborted || request.current !== controller) return;
      request.current = null;
      publish({ ...current.current, guides: [], status: 'error' });
    });
  }, [cancel, publish, searchItems]);

  const clear = useCallback((query = '') => {
    cancel();
    publish({ ...current.current, query, submittedQuery: null, guides: [], status: 'idle' });
  }, [cancel, publish]);

  const submit = useCallback((query = current.current.query) => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      clear();
      return;
    }
    startSearch(trimmed, trimmed);
  }, [clear, startSearch]);

  const editQuery = useCallback((query: string) => {
    cancel();
    const previous = current.current;
    const keepResult = previous.status === 'success' || previous.status === 'empty';
    publish({
      ...previous,
      query,
      submittedQuery: keepResult ? previous.submittedQuery : null,
      guides: keepResult ? previous.guides : [],
      status: keepResult ? previous.status : 'idle',
    });
  }, [cancel, publish]);

  const retry = useCallback(() => {
    const previous = current.current;
    if (previous.status !== 'error' || previous.submittedQuery === null) return;
    startSearch(previous.submittedQuery, previous.query);
  }, [startSearch]);

  const rememberScroll = useCallback((offset: number) => {
    if (Number.isFinite(offset) && offset >= 0 && offset !== current.current.scrollOffset) {
      publish({ ...current.current, scrollOffset: offset });
    }
  }, [publish]);

  useEffect(() => {
    const restored = initial.current;
    if (restored.submittedQuery !== null) {
      startSearch(restored.submittedQuery, restored.query, true);
    }
    return cancel;
  }, [cancel, startSearch]);

  useEffect(() => {
    const query = initialQuery?.trim();
    if (!query || query === current.current.handledInitialQuery) return;
    publish({ ...current.current, handledInitialQuery: query });
    submit(query);
  }, [initialQuery, publish, submit]);

  useEffect(() => {
    const { query, submittedQuery, handledInitialQuery, resultVersion, scrollOffset } = state;
    onSnapshot?.({ query, submittedQuery, handledInitialQuery, resultVersion, scrollOffset });
  }, [onSnapshot, state]);

  return { ...state, clear, submit, editQuery, retry, rememberScroll };
}
