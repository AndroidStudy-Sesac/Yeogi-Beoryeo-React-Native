import {
  FAVORITE_STORAGE_KEY,
  parseStoredFavorites,
  type StoredFavorite,
} from './favorite-store.ts';
import {
  HOME_CATEGORY_STORAGE_KEY,
  parseSelectedIds,
} from './home-category-store.ts';

export type LegacyItemData = Readonly<{
  sourceFound: boolean;
  favorites: readonly Readonly<{
    targetId: string;
    savedAtMillis: number;
  }>[];
  homeCategoryIds: readonly string[];
}>;

export type LegacyItemDataModule = Readonly<{
  readLegacyItemData: () => Promise<unknown>;
}>;

export type MigrationStorage = Readonly<{
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}>;

export type LegacyItemDataMigrationResult =
  | 'migrated'
  | 'already-migrated'
  | 'unavailable';

export const LEGACY_ITEM_DATA_MIGRATION_KEY =
  'yeogi-beoryeo:legacy-item-data-migration:v1';

const legacyHomeCategoryIdByAndroidName: Readonly<Record<string, string>> = {
  PAPER: 'paper',
  PAPER_PACK: 'paper-pack',
  COLORLESS_PET: 'colorless-pet',
  GLASS: 'glass',
  METAL: 'metal',
  PLASTIC: 'plastic',
  STYROFOAM: 'styrofoam',
  VINYL: 'vinyl',
  FOOD_WASTE: 'food-waste',
  LARGE_WASTE: 'large-waste',
  ELECTRONICS: 'electronics',
  BATTERY: 'battery',
  LIGHTING: 'lighting',
  CLOTHING: 'clothing',
  HAZARDOUS: 'hazardous',
  NON_COMBUSTIBLE: 'non-combustible',
  CONSTRUCTION_WASTE: 'construction-waste',
  GENERAL: 'general',
  OTHER: 'other',
};

function parseLegacyItemData(value: unknown): LegacyItemData {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('기존 Android 데이터 응답 형식이 올바르지 않습니다.');
  }

  const sourceFound =
    'sourceFound' in value && typeof value.sourceFound === 'boolean'
      ? value.sourceFound
      : false;
  const favorites =
    'favorites' in value && Array.isArray(value.favorites)
      ? value.favorites.flatMap((entry): StoredFavorite[] => {
          if (
            typeof entry !== 'object' ||
            entry === null ||
            !('targetId' in entry) ||
            typeof entry.targetId !== 'string' ||
            !('savedAtMillis' in entry) ||
            typeof entry.savedAtMillis !== 'number' ||
            !Number.isFinite(entry.savedAtMillis)
          ) {
            return [];
          }
          return [{ targetId: entry.targetId, savedAtMillis: entry.savedAtMillis }];
        })
      : [];
  const homeCategoryIds =
    'homeCategoryIds' in value && Array.isArray(value.homeCategoryIds)
      ? value.homeCategoryIds.filter(
          (entry): entry is string => typeof entry === 'string',
        )
      : [];

  return { sourceFound, favorites, homeCategoryIds };
}

function mergeFavorites(
  current: readonly StoredFavorite[],
  legacy: readonly StoredFavorite[],
  knownItemIds: ReadonlySet<string>,
): StoredFavorite[] {
  const savedAtById = new Map<string, number>();
  for (const favorite of [...current, ...legacy]) {
    if (!knownItemIds.has(favorite.targetId)) continue;
    savedAtById.set(
      favorite.targetId,
      Math.max(savedAtById.get(favorite.targetId) ?? 0, favorite.savedAtMillis),
    );
  }

  return [...savedAtById]
    .map(([targetId, savedAtMillis]) => ({ targetId, savedAtMillis }))
    .sort((left, right) => right.savedAtMillis - left.savedAtMillis);
}

export async function migrateLegacyItemData(
  storage: MigrationStorage,
  nativeModule: LegacyItemDataModule | null,
  knownItemIds: readonly string[],
  knownCategoryIds: readonly string[],
): Promise<LegacyItemDataMigrationResult> {
  if (nativeModule === null) return 'unavailable';
  if ((await storage.getItem(LEGACY_ITEM_DATA_MIGRATION_KEY)) === '1') {
    return 'already-migrated';
  }

  const legacy = parseLegacyItemData(await nativeModule.readLegacyItemData());
  const knownItems = new Set(knownItemIds);
  const knownCategories = new Set(knownCategoryIds);
  const currentFavorites = parseStoredFavorites(
    await storage.getItem(FAVORITE_STORAGE_KEY),
  );
  const favorites = mergeFavorites(
    currentFavorites,
    legacy.favorites,
    knownItems,
  );
  const currentCategories = parseSelectedIds(
    await storage.getItem(HOME_CATEGORY_STORAGE_KEY),
    knownCategories,
  );
  const legacyCategories = parseSelectedIds(
    JSON.stringify(
      legacy.homeCategoryIds.map(
        (categoryId) =>
          legacyHomeCategoryIdByAndroidName[categoryId] ?? categoryId,
      ),
    ),
    knownCategories,
  );
  const categories =
    currentCategories.length > 0 ? currentCategories : legacyCategories;

  await storage.setItem(FAVORITE_STORAGE_KEY, JSON.stringify(favorites));
  await storage.setItem(HOME_CATEGORY_STORAGE_KEY, JSON.stringify(categories));
  await storage.setItem(LEGACY_ITEM_DATA_MIGRATION_KEY, '1');
  return 'migrated';
}
