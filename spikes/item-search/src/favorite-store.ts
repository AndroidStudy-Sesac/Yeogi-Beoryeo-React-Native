export type FavoriteStorage = Readonly<{
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}>;

export type FavoriteStoreError =
  | Readonly<{ type: 'load' }>
  | Readonly<{ type: 'save'; itemIds: readonly string[] }>;

export type FavoriteStoreState = Readonly<{
  status: 'loading' | 'ready' | 'error';
  itemIds: readonly string[];
  pendingItemIds: readonly string[];
  error: FavoriteStoreError | null;
}>;

export type FavoriteToggleResult = 'added' | 'removed' | 'ignored' | 'failed';

export type StoredFavorite = Readonly<{
  targetId: string;
  savedAtMillis: number;
}>;

export const FAVORITE_STORAGE_KEY = 'yeogi-beoryeo:item-favorites:v1';
const RAPID_INPUT_GUARD_MS = 500;

const initialState: FavoriteStoreState = {
  status: 'loading',
  itemIds: [],
  pendingItemIds: [],
  error: null,
};

export function parseStoredFavorites(rawValue: string | null): StoredFavorite[] {
  if (rawValue === null) return [];

  let value: unknown;
  try {
    value = JSON.parse(rawValue) as unknown;
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];

  return value.reduce<StoredFavorite[]>((favorites, entry, index) => {
    let favorite: StoredFavorite | undefined;
    if (typeof entry === 'string') {
      favorite = { targetId: entry, savedAtMillis: -index };
    } else if (
      typeof entry === 'object' &&
      entry !== null &&
      'targetId' in entry &&
      typeof entry.targetId === 'string' &&
      'savedAtMillis' in entry &&
      typeof entry.savedAtMillis === 'number' &&
      Number.isFinite(entry.savedAtMillis)
    ) {
      favorite = {
        targetId: entry.targetId,
        savedAtMillis: entry.savedAtMillis,
      };
    }

    if (
      favorite !== undefined &&
      favorite.targetId.length > 0 &&
      !favorites.some((saved) => saved.targetId === favorite.targetId)
    ) {
      favorites.push(favorite);
    }
    return favorites;
  }, []).sort((left, right) => right.savedAtMillis - left.savedAtMillis);
}

export function resolveFavoriteItems<T>(
  itemIds: readonly string[],
  findItem: (itemId: string) => T | undefined,
): T[] {
  return itemIds.flatMap((itemId) => {
    const item = findItem(itemId);
    return item === undefined ? [] : [item];
  });
}

export class FavoriteStore {
  private readonly storage: FavoriteStorage;
  private readonly wallClockNow: () => number;
  private readonly monotonicNow: () => number;
  private state: FavoriteStoreState = initialState;
  private savedAtMillisByItemId = new Map<string, number>();
  private readonly listeners = new Set<() => void>();
  private readonly lastToggleAtByItemId = new Map<string, number>();
  private writeQueue: Promise<void> = Promise.resolve();
  private loadPromise?: Promise<void>;
  private initialized = false;

  constructor(
    storage: FavoriteStorage,
    wallClockNow: () => number = Date.now,
    monotonicNow: () => number = () => globalThis.performance.now(),
  ) {
    this.storage = storage;
    this.wallClockNow = wallClockNow;
    this.monotonicNow = monotonicNow;
  }

  readonly getSnapshot = (): FavoriteStoreState => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  initialize(): Promise<void> {
    if (this.initialized) return Promise.resolve();
    return this.load();
  }

  retryLoad(): Promise<void> {
    return this.load();
  }

  toggle(itemId: string): Promise<FavoriteToggleResult> {
    if (this.state.status !== 'ready' || itemId.length === 0) {
      return Promise.resolve('ignored');
    }
    if (this.state.pendingItemIds.includes(itemId)) {
      return Promise.resolve('ignored');
    }

    const acceptedAt = this.monotonicNow();
    const lastAcceptedAt = this.lastToggleAtByItemId.get(itemId);
    if (
      lastAcceptedAt !== undefined &&
      acceptedAt - lastAcceptedAt < RAPID_INPUT_GUARD_MS
    ) {
      return Promise.resolve('ignored');
    }

    this.lastToggleAtByItemId.set(itemId, acceptedAt);
    this.updateState({
      ...this.state,
      pendingItemIds: [...this.state.pendingItemIds, itemId],
      error:
        this.state.error?.type === 'save'
          ? this.saveErrorWithoutItem(this.state.error, itemId)
          : this.state.error,
    });

    const operation = this.writeQueue.then(() => this.persistToggle(itemId));
    this.writeQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private load(): Promise<void> {
    if (this.loadPromise !== undefined) return this.loadPromise;

    this.updateState({ ...this.state, status: 'loading', error: null });
    const load = (async () => {
      try {
        const favorites = parseStoredFavorites(
          await this.storage.getItem(FAVORITE_STORAGE_KEY),
        );
        const itemIds = favorites.map((favorite) => favorite.targetId);
        this.savedAtMillisByItemId = new Map(
          favorites.map((favorite) => [favorite.targetId, favorite.savedAtMillis]),
        );
        this.initialized = true;
        this.updateState({
          status: 'ready',
          itemIds,
          pendingItemIds: [],
          error: null,
        });
      } catch {
        this.initialized = false;
        this.updateState({
          ...this.state,
          status: 'error',
          pendingItemIds: [],
          error: { type: 'load' },
        });
      }
    })();

    this.loadPromise = load.finally(() => {
      this.loadPromise = undefined;
    });
    return this.loadPromise;
  }

  private async persistToggle(itemId: string): Promise<FavoriteToggleResult> {
    const isFavorite = this.state.itemIds.includes(itemId);
    const nextItemIds = isFavorite
      ? this.state.itemIds.filter((savedId) => savedId !== itemId)
      : [itemId, ...this.state.itemIds];
    const nextSavedAtMillisByItemId = new Map(this.savedAtMillisByItemId);
    if (isFavorite) {
      nextSavedAtMillisByItemId.delete(itemId);
    } else {
      const latestSavedAtMillis = Math.max(
        0,
        ...nextSavedAtMillisByItemId.values(),
      );
      nextSavedAtMillisByItemId.set(
        itemId,
        Math.max(this.wallClockNow(), latestSavedAtMillis + 1),
      );
    }
    const storedFavorites = nextItemIds.map((targetId) => ({
      targetId,
      savedAtMillis: nextSavedAtMillisByItemId.get(targetId) ?? 0,
    }));

    try {
      await this.storage.setItem(
        FAVORITE_STORAGE_KEY,
        JSON.stringify(storedFavorites),
      );
      this.savedAtMillisByItemId = nextSavedAtMillisByItemId;
      this.updateState({
        ...this.state,
        itemIds: nextItemIds,
        pendingItemIds: this.state.pendingItemIds.filter(
          (pendingId) => pendingId !== itemId,
        ),
        error:
          this.state.error?.type === 'save'
            ? this.saveErrorWithoutItem(this.state.error, itemId)
            : this.state.error,
      });
      return isFavorite ? 'removed' : 'added';
    } catch {
      this.lastToggleAtByItemId.delete(itemId);
      this.updateState({
        ...this.state,
        pendingItemIds: this.state.pendingItemIds.filter(
          (pendingId) => pendingId !== itemId,
        ),
        error: {
          type: 'save',
          itemIds:
            this.state.error?.type === 'save'
              ? [...new Set([...this.state.error.itemIds, itemId])]
              : [itemId],
        },
      });
      return 'failed';
    }
  }

  private updateState(state: FavoriteStoreState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }

  private saveErrorWithoutItem(
    error: Extract<FavoriteStoreError, { type: 'save' }>,
    itemId: string,
  ): FavoriteStoreError | null {
    const itemIds = error.itemIds.filter((failedId) => failedId !== itemId);
    return itemIds.length === 0 ? null : { type: 'save', itemIds };
  }
}
