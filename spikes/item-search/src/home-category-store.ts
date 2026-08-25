export type HomeCategoryStorage = Readonly<{
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}>;

export type HomeCategoryStoreError =
  | Readonly<{ type: 'load' }>
  | Readonly<{ type: 'save'; categoryIds: readonly string[] }>;

export type HomeCategoryStoreState = Readonly<{
  status: 'loading' | 'ready' | 'error';
  selectedIds: readonly string[];
  pendingIds: readonly string[];
  error: HomeCategoryStoreError | null;
}>;

export type HomeCategoryToggleResult =
  | 'selected'
  | 'deselected'
  | 'limit-reached'
  | 'ignored'
  | 'failed';

export type HomeCategoryLimitResult =
  | 'trimmed'
  | 'unchanged'
  | 'ignored'
  | 'failed';

export type HomeCategoryRetryResult = 'saved' | 'ignored' | 'failed';

type ToggleOperation = Readonly<{
  type: 'toggle';
  categoryId: string;
  maxSelectedCount: number;
}>;

type LimitOperation = Readonly<{
  type: 'limit';
  generation: number;
  maxSelectedCount: number;
  affectedIds?: readonly string[];
}>;

type WriteOperation = ToggleOperation | LimitOperation;
type WriteResult = HomeCategoryToggleResult | HomeCategoryLimitResult;

const STORAGE_KEY = 'yeogi-beoryeo:home-category-settings:v1';
const RAPID_INPUT_GUARD_MS = 500;

const initialState: HomeCategoryStoreState = {
  status: 'loading',
  selectedIds: [],
  pendingIds: [],
  error: null,
};

function normalizeLimit(maxSelectedCount: number): number {
  return Number.isFinite(maxSelectedCount)
    ? Math.max(0, Math.floor(maxSelectedCount))
    : 0;
}

function parseSelectedIds(
  rawValue: string | null,
  knownIds: ReadonlySet<string>,
): string[] {
  if (rawValue === null) return [];

  let value: unknown;
  try {
    value = JSON.parse(rawValue) as unknown;
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];

  const selectedIds: string[] = [];
  for (const entry of value) {
    if (
      typeof entry === 'string' &&
      knownIds.has(entry) &&
      !selectedIds.includes(entry)
    ) {
      selectedIds.push(entry);
    }
  }
  return selectedIds;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export class HomeCategoryStore {
  private readonly storage: HomeCategoryStorage;
  private readonly knownIds: ReadonlySet<string>;
  private readonly monotonicNow: () => number;
  private state: HomeCategoryStoreState = initialState;
  private readonly listeners = new Set<() => void>();
  private readonly lastToggleAtById = new Map<string, number>();
  private failedOperations: WriteOperation[] = [];
  private limitGeneration = 0;
  private forceLimitWriteGeneration?: number;
  private writeQueue: Promise<void> = Promise.resolve();
  private loadPromise?: Promise<void>;
  private initialized = false;

  constructor(
    storage: HomeCategoryStorage,
    knownCategoryIds: readonly string[],
    monotonicNow: () => number = () => globalThis.performance.now(),
  ) {
    this.storage = storage;
    this.knownIds = new Set(knownCategoryIds.filter((id) => id.length > 0));
    this.monotonicNow = monotonicNow;
  }

  readonly getSnapshot = (): HomeCategoryStoreState => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly initialize = (): Promise<void> => {
    if (this.initialized) return Promise.resolve();
    return this.load();
  };

  readonly retryLoad = (): Promise<void> => this.load();

  readonly toggle = (
    categoryId: string,
    maxSelectedCount: number,
  ): Promise<HomeCategoryToggleResult> => {
    if (
      this.state.status !== 'ready' ||
      !this.knownIds.has(categoryId) ||
      this.state.pendingIds.includes(categoryId)
    ) {
      return Promise.resolve('ignored');
    }

    const acceptedAt = this.monotonicNow();
    const lastAcceptedAt = this.lastToggleAtById.get(categoryId);
    if (
      lastAcceptedAt !== undefined &&
      acceptedAt - lastAcceptedAt < RAPID_INPUT_GUARD_MS
    ) {
      return Promise.resolve('ignored');
    }

    this.lastToggleAtById.set(categoryId, acceptedAt);
    this.removeFailedOperations(
      (operation) =>
        operation.type === 'toggle' && operation.categoryId === categoryId,
    );
    this.updateState({
      ...this.state,
      pendingIds: unique([...this.state.pendingIds, categoryId]),
    });

    return this.enqueue({
      type: 'toggle',
      categoryId,
      maxSelectedCount: normalizeLimit(maxSelectedCount),
    }) as Promise<HomeCategoryToggleResult>;
  };

  readonly limit = (
    maxSelectedCount: number,
  ): Promise<HomeCategoryLimitResult> => {
    if (this.state.status !== 'ready') return Promise.resolve('ignored');

    this.limitGeneration += 1;
    if (this.forceLimitWriteGeneration !== undefined) {
      this.forceLimitWriteGeneration = this.limitGeneration;
    }
    this.removeFailedOperations((operation) => operation.type === 'limit');
    return this.enqueue({
      type: 'limit',
      generation: this.limitGeneration,
      maxSelectedCount: normalizeLimit(maxSelectedCount),
    }) as Promise<HomeCategoryLimitResult>;
  };

  readonly retrySave = async (): Promise<HomeCategoryRetryResult> => {
    if (this.state.status !== 'ready') return 'ignored';

    await this.writeQueue;
    if (this.failedOperations.length === 0) return 'ignored';

    const retryOperations = this.failedOperations.filter(
      (operation) =>
        operation.type === 'toggle' ||
        operation.generation === this.limitGeneration,
    );
    this.failedOperations = [];
    if (retryOperations.length === 0) {
      this.updateState({ ...this.state, error: null });
      return 'ignored';
    }
    const retryToggleIds = retryOperations.flatMap((operation) =>
      operation.type === 'toggle' ? [operation.categoryId] : [],
    );
    this.updateState({
      ...this.state,
      pendingIds: unique([...this.state.pendingIds, ...retryToggleIds]),
      error: null,
    });

    const results = await Promise.all(
      retryOperations.map((operation) => this.enqueue(operation)),
    );
    return results.some((result) => result === 'failed') ? 'failed' : 'saved';
  };

  private load(): Promise<void> {
    if (this.loadPromise !== undefined) return this.loadPromise;

    this.updateState({ ...this.state, status: 'loading', error: null });
    const load = (async () => {
      try {
        const selectedIds = parseSelectedIds(
          await this.storage.getItem(STORAGE_KEY),
          this.knownIds,
        );
        this.failedOperations = [];
        this.initialized = true;
        this.updateState({
          status: 'ready',
          selectedIds,
          pendingIds: [],
          error: null,
        });
      } catch {
        this.initialized = false;
        this.updateState({
          ...this.state,
          status: 'error',
          pendingIds: [],
          error: { type: 'load' },
        });
      }
    })();

    this.loadPromise = load.finally(() => {
      this.loadPromise = undefined;
    });
    return this.loadPromise;
  }

  private enqueue(operation: WriteOperation): Promise<WriteResult> {
    const write = this.writeQueue.then(() => this.persist(operation));
    this.writeQueue = write.then(
      () => undefined,
      () => undefined,
    );
    return write;
  }

  private persist(operation: WriteOperation): Promise<WriteResult> {
    if (this.failedOperations.length > 0) {
      return Promise.resolve(this.deferOperation(operation));
    }
    return operation.type === 'toggle'
      ? this.persistToggle(operation)
      : this.persistLimit(operation);
  }

  private deferOperation(operation: WriteOperation): WriteResult {
    const failedOperation =
      operation.type === 'limit'
        ? {
            ...operation,
            affectedIds: this.state.selectedIds.slice(
              operation.maxSelectedCount,
            ),
          }
        : operation;
    this.failedOperations.push(failedOperation);
    this.updateState({
      ...this.state,
      pendingIds:
        operation.type === 'toggle'
          ? this.state.pendingIds.filter(
              (id) => id !== operation.categoryId,
            )
          : this.state.pendingIds,
      error: this.createSaveError(),
    });
    return 'failed';
  }

  private async persistToggle(
    operation: ToggleOperation,
  ): Promise<HomeCategoryToggleResult> {
    const { categoryId, maxSelectedCount } = operation;
    const isSelected = this.state.selectedIds.includes(categoryId);
    if (!isSelected && this.state.selectedIds.length >= maxSelectedCount) {
      this.removePendingIds([categoryId]);
      return 'limit-reached';
    }

    const nextSelectedIds = isSelected
      ? this.state.selectedIds.filter((selectedId) => selectedId !== categoryId)
      : [...this.state.selectedIds, categoryId];

    try {
      await this.storage.setItem(STORAGE_KEY, JSON.stringify(nextSelectedIds));
      this.updateState({
        ...this.state,
        selectedIds: nextSelectedIds,
        pendingIds: this.state.pendingIds.filter((id) => id !== categoryId),
        error: this.createSaveError(),
      });
      return isSelected ? 'deselected' : 'selected';
    } catch {
      this.lastToggleAtById.delete(categoryId);
      this.failedOperations.push(operation);
      this.updateState({
        ...this.state,
        pendingIds: this.state.pendingIds.filter((id) => id !== categoryId),
        error: this.createSaveError(),
      });
      return 'failed';
    }
  }

  private async persistLimit(
    operation: LimitOperation,
  ): Promise<HomeCategoryLimitResult> {
    if (operation.generation !== this.limitGeneration) return 'unchanged';

    const nextSelectedIds = this.state.selectedIds.slice(
      0,
      operation.maxSelectedCount,
    );
    const mustRestoreLatestState =
      this.forceLimitWriteGeneration === operation.generation;
    if (
      nextSelectedIds.length === this.state.selectedIds.length &&
      !mustRestoreLatestState
    ) {
      return 'unchanged';
    }

    const affectedIds = this.state.selectedIds.slice(operation.maxSelectedCount);
    this.updateState({
      ...this.state,
      pendingIds: unique([...this.state.pendingIds, ...affectedIds]),
    });

    try {
      await this.storage.setItem(STORAGE_KEY, JSON.stringify(nextSelectedIds));
      if (operation.generation !== this.limitGeneration) {
        this.forceLimitWriteGeneration = this.limitGeneration;
        this.removePendingIds(affectedIds);
        return 'unchanged';
      }
      if (mustRestoreLatestState) this.forceLimitWriteGeneration = undefined;
      this.updateState({
        ...this.state,
        selectedIds: nextSelectedIds,
        pendingIds: this.state.pendingIds.filter(
          (id) => !affectedIds.includes(id),
        ),
        error: this.createSaveError(),
      });
      return 'trimmed';
    } catch {
      if (operation.generation !== this.limitGeneration) {
        this.removePendingIds(affectedIds);
        return 'unchanged';
      }
      this.failedOperations.push({ ...operation, affectedIds });
      this.updateState({
        ...this.state,
        pendingIds: this.state.pendingIds.filter(
          (id) => !affectedIds.includes(id),
        ),
        error: this.createSaveError(),
      });
      return 'failed';
    }
  }

  private removeFailedOperations(
    predicate: (operation: WriteOperation) => boolean,
  ): void {
    const remaining = this.failedOperations.filter(
      (operation) => !predicate(operation),
    );
    if (remaining.length === this.failedOperations.length) return;

    this.failedOperations = remaining;
    this.updateState({ ...this.state, error: this.createSaveError() });
  }

  private createSaveError(): HomeCategoryStoreError | null {
    if (this.failedOperations.length === 0) return null;

    const categoryIds = unique(
      this.failedOperations.flatMap((operation) =>
        operation.type === 'toggle'
          ? [operation.categoryId]
          : (operation.affectedIds ?? []),
      ),
    );
    return { type: 'save', categoryIds };
  }

  private removePendingIds(categoryIds: readonly string[]): void {
    this.updateState({
      ...this.state,
      pendingIds: this.state.pendingIds.filter(
        (id) => !categoryIds.includes(id),
      ),
    });
  }

  private updateState(state: HomeCategoryStoreState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
}
