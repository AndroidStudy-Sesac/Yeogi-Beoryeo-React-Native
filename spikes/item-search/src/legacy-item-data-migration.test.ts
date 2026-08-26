import assert from 'node:assert/strict';
import test from 'node:test';

import { FAVORITE_STORAGE_KEY } from './favorite-store.ts';
import { HOME_CATEGORY_STORAGE_KEY } from './home-category-store.ts';
import {
  LEGACY_ITEM_DATA_MIGRATION_KEY,
  migrateLegacyItemData,
  type LegacyItemDataModule,
  type MigrationStorage,
} from './legacy-item-data-migration.ts';

class MemoryStorage implements MigrationStorage {
  readonly values = new Map<string, string>();
  failNextKey?: string;

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.failNextKey === key) {
      this.failNextKey = undefined;
      throw new Error('저장 실패');
    }
    this.values.set(key, value);
  }
}

function legacyModule(
  favorites: readonly Readonly<{
    targetId: string;
    savedAtMillis: number;
  }>[],
  homeCategoryIds: readonly string[],
): LegacyItemDataModule {
  return {
    readLegacyItemData: async () => ({
      sourceFound: true,
      favorites,
      homeCategoryIds,
    }),
  };
}

test('Android 모듈이 없으면 이전하지 않는다', async () => {
  const storage = new MemoryStorage();

  assert.equal(
    await migrateLegacyItemData(storage, null, ['item-a'], ['paper']),
    'unavailable',
  );
  assert.equal(storage.values.size, 0);
});

test('완료 표시가 있으면 기존 데이터를 다시 읽지 않는다', async () => {
  const storage = new MemoryStorage();
  storage.values.set(LEGACY_ITEM_DATA_MIGRATION_KEY, '1');
  let readCount = 0;

  assert.equal(
    await migrateLegacyItemData(
      storage,
      {
        readLegacyItemData: async () => {
          readCount += 1;
          return {};
        },
      },
      [],
      [],
    ),
    'already-migrated',
  );
  assert.equal(readCount, 0);
});

test('품목 즐겨찾기와 홈 표시 설정을 중복 없이 이전한다', async () => {
  const storage = new MemoryStorage();

  assert.equal(
    await migrateLegacyItemData(
      storage,
      legacyModule(
        [
          { targetId: 'item-a', savedAtMillis: 10 },
          { targetId: 'item-a', savedAtMillis: 20 },
          { targetId: 'unknown', savedAtMillis: 30 },
          { targetId: 'item-b', savedAtMillis: 15 },
        ],
        ['PAPER', 'unknown', 'PAPER', 'GLASS'],
      ),
      ['item-a', 'item-b'],
      ['paper', 'glass'],
    ),
    'migrated',
  );
  assert.deepEqual(JSON.parse(storage.values.get(FAVORITE_STORAGE_KEY) ?? ''), [
    { targetId: 'item-a', savedAtMillis: 20 },
    { targetId: 'item-b', savedAtMillis: 15 },
  ]);
  assert.deepEqual(
    JSON.parse(storage.values.get(HOME_CATEGORY_STORAGE_KEY) ?? ''),
    ['paper', 'glass'],
  );
  assert.equal(storage.values.get(LEGACY_ITEM_DATA_MIGRATION_KEY), '1');
});

test('Android enum 이름을 현재 홈 카테고리 ID로 바꾸고 순서를 유지한다', async () => {
  const storage = new MemoryStorage();

  await migrateLegacyItemData(
    storage,
    legacyModule(
      [],
      [
        'PAPER_PACK',
        'COLORLESS_PET',
        'NON_COMBUSTIBLE',
        'CONSTRUCTION_WASTE',
      ],
    ),
    [],
    [
      'paper-pack',
      'colorless-pet',
      'non-combustible',
      'construction-waste',
    ],
  );

  assert.deepEqual(
    JSON.parse(storage.values.get(HOME_CATEGORY_STORAGE_KEY) ?? ''),
    [
      'paper-pack',
      'colorless-pet',
      'non-combustible',
      'construction-waste',
    ],
  );
});

test('이미 저장한 React Native 값은 이전 데이터와 합쳐 보존한다', async () => {
  const storage = new MemoryStorage();
  storage.values.set(
    FAVORITE_STORAGE_KEY,
    JSON.stringify([{ targetId: 'item-b', savedAtMillis: 40 }]),
  );
  storage.values.set(HOME_CATEGORY_STORAGE_KEY, JSON.stringify(['glass']));

  await migrateLegacyItemData(
    storage,
    legacyModule([{ targetId: 'item-a', savedAtMillis: 20 }], ['paper']),
    ['item-a', 'item-b'],
    ['paper', 'glass'],
  );

  assert.deepEqual(JSON.parse(storage.values.get(FAVORITE_STORAGE_KEY) ?? ''), [
    { targetId: 'item-b', savedAtMillis: 40 },
    { targetId: 'item-a', savedAtMillis: 20 },
  ]);
  assert.deepEqual(
    JSON.parse(storage.values.get(HOME_CATEGORY_STORAGE_KEY) ?? ''),
    ['glass'],
  );
});

test('일부 저장이 실패하면 완료 처리하지 않고 다음 실행에서 다시 이전한다', async () => {
  const storage = new MemoryStorage();
  storage.failNextKey = HOME_CATEGORY_STORAGE_KEY;
  const module = legacyModule(
    [{ targetId: 'item-a', savedAtMillis: 20 }],
    ['paper'],
  );

  await assert.rejects(
    migrateLegacyItemData(storage, module, ['item-a'], ['paper']),
    /저장 실패/,
  );
  assert.equal(storage.values.has(LEGACY_ITEM_DATA_MIGRATION_KEY), false);

  assert.equal(
    await migrateLegacyItemData(storage, module, ['item-a'], ['paper']),
    'migrated',
  );
  assert.deepEqual(JSON.parse(storage.values.get(FAVORITE_STORAGE_KEY) ?? ''), [
    { targetId: 'item-a', savedAtMillis: 20 },
  ]);
  assert.equal(storage.values.get(LEGACY_ITEM_DATA_MIGRATION_KEY), '1');
});
