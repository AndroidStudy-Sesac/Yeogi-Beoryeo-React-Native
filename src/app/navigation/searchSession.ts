import AsyncStorage from '@react-native-async-storage/async-storage';
import type { InitialState, NavigationState } from '@react-navigation/native';

import type { ItemSearchSnapshot } from '../../features/item-search/presentation/useItemSearch';
import { APP_SCREEN_ROUTES } from './routes';

const STORAGE_KEY = 'item-search-session-v1';
type SearchSession = { sessionId: string; search: ItemSearchSnapshot; guideId?: string; detailScrollOffset?: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSnapshot(value: unknown): value is ItemSearchSnapshot {
  return isRecord(value) && typeof value.query === 'string' &&
    (value.submittedQuery === null || typeof value.submittedQuery === 'string') &&
    (value.handledInitialQuery === null || typeof value.handledInitialQuery === 'string') &&
    typeof value.resultVersion === 'number' && Number.isSafeInteger(value.resultVersion) && value.resultVersion >= 0 &&
    typeof value.scrollOffset === 'number' && Number.isFinite(value.scrollOffset) && value.scrollOffset >= 0;
}

export async function readSearchSession(sessionId: string): Promise<InitialState | undefined> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const saved: unknown = raw ? JSON.parse(raw) : undefined;
    if (!isRecord(saved) || saved.sessionId !== sessionId || !isSnapshot(saved.search) ||
      (saved.guideId !== undefined && (typeof saved.guideId !== 'string' || !saved.guideId)) ||
      (saved.detailScrollOffset !== undefined && (typeof saved.detailScrollOffset !== 'number' ||
        !Number.isFinite(saved.detailScrollOffset) || saved.detailScrollOffset < 0))) return;
    const routes: InitialState['routes'] = [{
      name: APP_SCREEN_ROUTES.ITEM_SEARCH,
      params: { savedSearchState: saved.search },
    }];
    if (typeof saved.guideId === 'string') routes.push({
      name: APP_SCREEN_ROUTES.ITEM_GUIDE_DETAIL, params: { guideId: saved.guideId, source: 'SEARCH',
        ...(saved.detailScrollOffset !== undefined && { scrollOffset: saved.detailScrollOffset }) },
    });
    return { index: routes.length - 1, routes };
  } catch {
    // An unreadable session must not prevent a fresh search.
    return undefined;
  }
}

/** Serialize writes so a slower scroll update cannot replace the final position. */
export function createSearchSessionWriter(sessionId: string) {
  let pending: Promise<void> = Promise.resolve();
  return (state: NavigationState | undefined): Promise<void> => {
    const searchRoute = state?.routes.find(route => route.name === APP_SCREEN_ROUTES.ITEM_SEARCH);
    const search = isRecord(searchRoute?.params) ? searchRoute.params.savedSearchState : undefined;
    if (!isSnapshot(search)) return pending;
    const activeRoute = state?.routes[state.index];
    const guideId = activeRoute?.name === APP_SCREEN_ROUTES.ITEM_GUIDE_DETAIL &&
      isRecord(activeRoute.params) && typeof activeRoute.params.guideId === 'string'
      ? activeRoute.params.guideId : undefined;
    const offset = isRecord(activeRoute?.params) ? activeRoute.params.scrollOffset : undefined;
    const detailScrollOffset = typeof offset === 'number' && Number.isFinite(offset) && offset >= 0 ? offset : undefined;
    const saved: SearchSession = { sessionId, search, ...(guideId && { guideId }),
      ...(guideId && detailScrollOffset !== undefined && { detailScrollOffset }) };
    const serialized = JSON.stringify(saved);
    pending = pending.then(() => AsyncStorage.setItem(STORAGE_KEY, serialized)).catch(() => {
      // Storage failure leaves the current in-memory search usable.
    });
    return pending;
  };
}
