import { useCallback, useEffect, useRef, useState } from 'react';

import { loadItemCatalog } from '../data/itemCatalog';
import type { ItemGuide } from '../domain/itemGuide';

export type LoadItemGuide = (
  id: string,
  signal: AbortSignal,
) => Promise<ItemGuide | null>;

type DetailState =
  | { status: 'loading' | 'not-found' | 'error'; guide: null }
  | { status: 'success'; guide: ItemGuide };

const loadBundledGuide: LoadItemGuide = async id =>
  loadItemCatalog().getItemGuide(id);

export function useItemGuide(guideId: string, loadGuide = loadBundledGuide) {
  const [state, setState] = useState<DetailState>({ status: 'loading', guide: null });
  const current = useRef(state);
  const request = useRef<{ id: string; controller: AbortController } | null>(null);

  const publish = useCallback((next: DetailState) => {
    current.current = next;
    setState(next);
  }, []);

  const cancel = useCallback(() => {
    request.current?.controller.abort();
    request.current = null;
  }, []);

  const load = useCallback(() => {
    if (request.current?.id === guideId) return;
    cancel();
    const controller = new AbortController();
    request.current = { id: guideId, controller };
    publish({ status: 'loading', guide: null });

    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return null;
      return loadGuide(guideId, controller.signal);
    }).then(guide => {
      if (controller.signal.aborted || request.current?.controller !== controller) return;
      request.current = null;
      publish(guide ? { status: 'success', guide } : { status: 'not-found', guide: null });
    }, () => {
      if (controller.signal.aborted || request.current?.controller !== controller) return;
      request.current = null;
      publish({ status: 'error', guide: null });
    });
  }, [cancel, guideId, loadGuide, publish]);

  useEffect(() => {
    load();
    return cancel;
  }, [cancel, load]);

  const retry = useCallback(() => {
    if (current.current.status === 'error') load();
  }, [load]);

  return { ...state, retry };
}
