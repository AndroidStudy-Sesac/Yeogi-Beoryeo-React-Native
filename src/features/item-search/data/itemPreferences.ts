import AsyncStorage from '@react-native-async-storage/async-storage';

import { homeCategories, type HomeCategoryId } from '../domain/homeCategories';
import { loadItemGuide } from './itemCatalog';

export const ITEM_PREFERENCES_KEY = 'yeogi:item-preferences:v1';
type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;
type Favorite = Readonly<{ id: string; savedAt: number }>;
export type ItemPreferences = Readonly<{
  version: 1;
  categories: readonly HomeCategoryId[];
  favorites: readonly Favorite[];
}>;
const empty: ItemPreferences = { version: 1, categories: [], favorites: [] };

export function parseItemPreferences(raw: string | null): ItemPreferences {
  if (raw === null) return empty;
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null || !('version' in value) || value.version !== 1
    || !('categories' in value) || !Array.isArray(value.categories)
    || !('favorites' in value) || !Array.isArray(value.favorites)) {
    throw new Error('Unsupported item preferences');
  }
  const categories = [...new Set(value.categories.filter((id): id is HomeCategoryId =>
    homeCategories.some(category => category.id === id)))];
  const favorites = new Map<string, Favorite>();
  for (const entry of value.favorites) {
    if (typeof entry !== 'object' || entry === null || typeof entry.id !== 'string'
      || typeof entry.savedAt !== 'number' || !Number.isFinite(entry.savedAt) || entry.savedAt < 0) continue;
    const guide = loadItemGuide(entry.id);
    if (!guide) continue;
    const previous = favorites.get(guide.id);
    if (!previous || previous.savedAt < entry.savedAt) favorites.set(guide.id, { id: guide.id, savedAt: entry.savedAt });
  }
  return { version: 1, categories, favorites: [...favorites.values()].sort((a, b) => b.savedAt - a.savedAt) };
}

type State = Readonly<{
  data: ItemPreferences;
  status: 'loading' | 'ready' | 'error';
  pending: readonly string[];
  writeError: boolean;
}>;

export class ItemPreferencesStore {
  private state: State = { data: empty, status: 'loading', pending: [], writeError: false };
  private readonly listeners = new Set<() => void>();
  private loadRequest: Promise<void> | undefined;
  private writes = Promise.resolve();

  constructor(private readonly storage: Storage = AsyncStorage, private readonly now = Date.now) {}

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(next: State) {
    this.state = next;
    this.listeners.forEach(listener => listener());
  }

  load = (): Promise<void> => {
    if (this.state.status === 'ready') return Promise.resolve();
    if (this.loadRequest) return this.loadRequest;
    this.publish({ ...this.state, status: 'loading' });
    this.loadRequest = Promise.resolve().then(() => this.storage.getItem(ITEM_PREFERENCES_KEY)).then(raw => {
      this.publish({ ...this.state, data: parseItemPreferences(raw), status: 'ready' });
    }).catch(() => {
      this.publish({ ...this.state, status: 'error' });
    }).finally(() => { this.loadRequest = undefined; });
    return this.loadRequest;
  };

  toggleFavorite = (identifier: string) => {
    const guide = loadItemGuide(identifier);
    if (!guide) return Promise.resolve(false);
    return this.change(guide.id, data => {
      const exists = data.favorites.some(item => item.id === guide.id);
      const favorites = data.favorites.filter(item => item.id !== guide.id);
      if (!exists) favorites.unshift({ id: guide.id, savedAt: this.now() });
      return { ...data, favorites: favorites.sort((a, b) => b.savedAt - a.savedAt) };
    });
  };

  removeFavorite = (id: string) => this.change(id, data => ({
    ...data, favorites: data.favorites.filter(item => item.id !== id),
  }));

  toggleCategory = (id: HomeCategoryId, maximum: number) => this.change(`category:${id}`, data => {
    const limit = Math.max(0, Math.min(homeCategories.length, Math.floor(maximum)));
    if (!Number.isFinite(limit) || !homeCategories.some(category => category.id === id)) return data;
    const selected = data.categories.includes(id);
    if (!selected && data.categories.length >= limit) return data;
    return { ...data, categories: selected ? data.categories.filter(value => value !== id) : [...data.categories, id] };
  });

  limitCategories = (maximum: number) => this.change('category:limit', data => {
    const limit = Math.max(0, Math.floor(maximum));
    return Number.isFinite(limit) && data.categories.length > limit
      ? { ...data, categories: data.categories.slice(0, limit) } : data;
  });

  dismissWriteError = () => this.publish({ ...this.state, writeError: false });

  private change(key: string, transform: (data: ItemPreferences) => ItemPreferences): Promise<boolean> {
    if (this.state.status !== 'ready' || this.state.pending.includes(key)) return Promise.resolve(false);
    this.publish({ ...this.state, pending: [...this.state.pending, key], writeError: false });
    const operation = this.writes.then(async () => {
      try {
        const data = transform(this.state.data);
        if (data !== this.state.data) await this.storage.setItem(ITEM_PREFERENCES_KEY, JSON.stringify(data));
        // Publish committed data and release this button together, even with other queued writes.
        this.publish({ ...this.state, data, pending: this.state.pending.filter(item => item !== key) });
        return true;
      } catch {
        this.publish({ ...this.state, writeError: true, pending: this.state.pending.filter(item => item !== key) });
        return false;
      }
    });
    this.writes = operation.then(() => undefined);
    return operation;
  }
}
