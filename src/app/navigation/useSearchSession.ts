import type { InitialState, NavigationState } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { createSearchSessionWriter, readSearchSession } from './searchSession';

export function useSearchSession(sessionId?: string) {
  const [restored, setRestored] = useState<{ ready: boolean; state?: InitialState }>({ ready: !sessionId });
  const writer = useMemo(() => sessionId ? createSearchSessionWriter(sessionId) : undefined, [sessionId]);
  const latestState = useRef<NavigationState | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    void readSearchSession(sessionId).then(state => {
      if (active) setRestored({ ready: true, state });
    });
    return () => { active = false; };
  }, [sessionId]);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    void writer?.(latestState.current);
  }, [writer]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') flush();
    });
    return () => { subscription.remove(); flush(); };
  }, [flush]);

  const onStateChange = useCallback((state: NavigationState | undefined) => {
    latestState.current = state;
    clearTimeout(timer.current);
    if (writer) timer.current = setTimeout(flush, 100);
  }, [flush, writer]);

  return { ready: restored.ready, initialState: restored.state, onStateChange };
}
