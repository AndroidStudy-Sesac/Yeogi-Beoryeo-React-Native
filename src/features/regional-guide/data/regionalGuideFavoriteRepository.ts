import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  isRegionalGuideFavorite,
  type RegionalGuideFavorite,
} from '../domain/regionalGuideFavorite';

export const REGIONAL_GUIDE_FAVORITES_STORAGE_KEY =
  '@yeogi-beoryeo/regional-guide-favorites';
export const REGIONAL_GUIDE_FAVORITES_SCHEMA_VERSION = 1;

export type FavoriteKeyValueStorage = Readonly<{
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}>;

type RegionalGuideFavoriteSchema = Readonly<{
  version: typeof REGIONAL_GUIDE_FAVORITES_SCHEMA_VERSION;
  favorites: readonly RegionalGuideFavorite[];
}>;

export type RegionalGuideFavoriteRepository = Readonly<{
  load(): Promise<readonly RegionalGuideFavorite[]>;
  save(favorites: readonly RegionalGuideFavorite[]): Promise<void>;
}>;

export function createRegionalGuideFavoriteRepository(
  storage: FavoriteKeyValueStorage = AsyncStorage,
): RegionalGuideFavoriteRepository {
  return {
    async load() {
      const serialized = await storage.getItem(
        REGIONAL_GUIDE_FAVORITES_STORAGE_KEY,
      );
      if (serialized === null) return [];

      try {
        const schema: unknown = JSON.parse(serialized);
        if (!isSupportedSchema(schema)) return [];
        return deduplicate(schema.favorites.filter(isRegionalGuideFavorite));
      } catch {
        return [];
      }
    },
    async save(favorites) {
      const schema: RegionalGuideFavoriteSchema = {
        version: REGIONAL_GUIDE_FAVORITES_SCHEMA_VERSION,
        favorites: deduplicate(favorites),
      };
      await storage.setItem(
        REGIONAL_GUIDE_FAVORITES_STORAGE_KEY,
        JSON.stringify(schema),
      );
    },
  };
}

function isSupportedSchema(
  value: unknown,
): value is Readonly<{ version: 1; favorites: unknown[] }> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    value.version === REGIONAL_GUIDE_FAVORITES_SCHEMA_VERSION &&
    'favorites' in value &&
    Array.isArray(value.favorites)
  );
}

function deduplicate(
  favorites: readonly RegionalGuideFavorite[],
): readonly RegionalGuideFavorite[] {
  return [...new Map(favorites.map(favorite => [favorite.targetId, favorite])).values()];
}
