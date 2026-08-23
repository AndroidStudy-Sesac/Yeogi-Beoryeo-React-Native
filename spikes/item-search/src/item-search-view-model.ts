import type { ItemGuide } from './catalog.ts';

export type SearchStatus = 'idle' | 'loading' | 'results' | 'empty' | 'error';

export type ItemSearchUiState = Readonly<{
  query: string;
  submittedQuery: string;
  status: SearchStatus;
  results: readonly ItemGuide[];
}>;

export type ItemSearchEvent = Readonly<{
  type: 'openDetail';
  itemId: string;
}>;

export type SearchCatalog = (
  query: string,
  signal: AbortSignal,
) => Promise<readonly ItemGuide[]>;

const initialState: ItemSearchUiState = {
  query: '',
  submittedQuery: '',
  status: 'idle',
  results: [],
};

export class ItemSearchViewModel {
  private state: ItemSearchUiState = initialState;
  private readonly stateListeners = new Set<() => void>();
  private readonly eventListeners = new Set<(event: ItemSearchEvent) => void>();
  private readonly searchCatalog: SearchCatalog;
  private activeSearch?: AbortController;

  constructor(searchCatalog: SearchCatalog) {
    this.searchCatalog = searchCatalog;
  }

  readonly getSnapshot = (): ItemSearchUiState => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  };

  readonly subscribeToEvents = (
    listener: (event: ItemSearchEvent) => void,
  ): (() => void) => {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  };

  setQuery(query: string): void {
    this.updateState({ ...this.state, query });
  }

  async search(query = this.state.query): Promise<void> {
    const submittedQuery = query.trim();
    if (submittedQuery.length === 0) return;
    if (
      this.state.status === 'loading' &&
      submittedQuery === this.state.submittedQuery
    ) {
      return;
    }

    this.activeSearch?.abort();
    const search = new AbortController();
    this.activeSearch = search;
    this.updateState({
      ...this.state,
      submittedQuery,
      status: 'loading',
      results: [],
    });

    try {
      const results = await this.searchCatalog(submittedQuery, search.signal);
      if (search.signal.aborted || this.activeSearch !== search) return;

      this.updateState({
        ...this.state,
        status: results.length === 0 ? 'empty' : 'results',
        results,
      });
    } catch {
      if (search.signal.aborted || this.activeSearch !== search) return;
      this.updateState({ ...this.state, status: 'error', results: [] });
    } finally {
      if (this.activeSearch === search) this.activeSearch = undefined;
    }
  }

  retry(): Promise<void> {
    if (this.state.status !== 'error') return Promise.resolve();
    return this.search(this.state.submittedQuery);
  }

  clearSearch(): void {
    this.activeSearch?.abort();
    this.activeSearch = undefined;
    this.updateState(initialState);
  }

  openDetail(itemId: string): void {
    const event: ItemSearchEvent = { type: 'openDetail', itemId };
    this.eventListeners.forEach((listener) => listener(event));
  }

  dispose(): void {
    this.activeSearch?.abort();
    this.activeSearch = undefined;
    this.stateListeners.clear();
    this.eventListeners.clear();
  }

  private updateState(state: ItemSearchUiState): void {
    this.state = state;
    this.stateListeners.forEach((listener) => listener());
  }
}
