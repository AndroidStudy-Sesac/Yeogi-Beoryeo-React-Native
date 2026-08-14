import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FavoriteStore,
  resolveFavoriteItems,
  type FavoriteStorage,
} from './favorite-store.ts';

class MemoryStorage implements FavoriteStorage {
  value: string | null;
  setCalls: string[] = [];
  getError?: Error;
  setError?: Error;

  constructor(value: string | null = null) {
    this.value = value;
  }

  async getItem(): Promise<string | null> {
    if (this.getError) throw this.getError;
    return this.value;
  }

  async setItem(_key: string, value: string): Promise<void> {
    this.setCalls.push(value);
    if (this.setError) throw this.setError;
    this.value = value;
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('restores unique item IDs in their saved order', async () => {
  const storage = new MemoryStorage(
    JSON.stringify([
      { targetId: 'item-2', savedAtMillis: 20 },
      { targetId: 'item-1', savedAtMillis: 10 },
      { targetId: 'item-2', savedAtMillis: 1 },
      3,
    ]),
  );
  const store = new FavoriteStore(storage);

  await store.initialize();

  assert.deepEqual(store.getSnapshot(), {
    status: 'ready',
    itemIds: ['item-2', 'item-1'],
    pendingItemIds: [],
    error: null,
  });
});

test('recovers malformed stored data as an empty favorite list', async () => {
  const malformedValues = ['not-json', JSON.stringify({ itemIds: ['item-1'] })];

  for (const value of malformedValues) {
    const store = new FavoriteStore(new MemoryStorage(value));
    await store.initialize();
    assert.equal(store.getSnapshot().status, 'ready');
    assert.deepEqual(store.getSnapshot().itemIds, []);
  }
});

test('adds newest items first, removes saved items, and restores them in a new store', async () => {
  const storage = new MemoryStorage();
  let now = 0;
  const store = new FavoriteStore(storage, () => now, () => now);
  await store.initialize();

  assert.equal(await store.toggle('item-1'), 'added');
  now += 500;
  assert.equal(await store.toggle('item-2'), 'added');
  now += 500;
  assert.equal(await store.toggle('item-1'), 'removed');
  assert.deepEqual(store.getSnapshot().itemIds, ['item-2']);

  const restoredStore = new FavoriteStore(storage);
  await restoredStore.initialize();
  assert.deepEqual(restoredStore.getSnapshot().itemIds, ['item-2']);
});

test('blocks a rapid repeated toggle for the same item while accepting another item', async () => {
  const firstWrite = deferred<void>();
  const storage: FavoriteStorage = {
    getItem: async () => null,
    setItem: async (_key, value) => {
      const favorites = JSON.parse(value) as Array<{ targetId: string }>;
      if (favorites[0]?.targetId === 'item-a') await firstWrite.promise;
    },
  };
  const store = new FavoriteStore(storage, () => 100, () => 100);
  await store.initialize();

  const firstA = store.toggle('item-a');
  const itemB = store.toggle('item-b');
  const secondA = store.toggle('item-a');
  assert.equal(await secondA, 'ignored');

  firstWrite.resolve();
  assert.deepEqual(await Promise.all([firstA, itemB]), ['added', 'added']);
  assert.deepEqual(store.getSnapshot().itemIds, ['item-b', 'item-a']);
});

test('keeps the 500 ms guard after a fast write finishes', async () => {
  const storage = new MemoryStorage();
  let now = 100;
  const store = new FavoriteStore(storage, () => now, () => now);
  await store.initialize();

  assert.equal(await store.toggle('item-1'), 'added');
  now = 599;
  assert.equal(await store.toggle('item-1'), 'ignored');
  assert.deepEqual(store.getSnapshot().itemIds, ['item-1']);

  now = 600;
  assert.equal(await store.toggle('item-1'), 'removed');
  assert.deepEqual(store.getSnapshot().itemIds, []);
});

test('keeps the previous state after a failed write and allows a later retry', async () => {
  const storage = new MemoryStorage(JSON.stringify(['item-1']));
  let now = 0;
  const store = new FavoriteStore(storage, () => now, () => now);
  await store.initialize();
  storage.setError = new Error('write failed');

  assert.equal(await store.toggle('item-1'), 'failed');
  assert.deepEqual(store.getSnapshot().itemIds, ['item-1']);
  assert.deepEqual(store.getSnapshot().pendingItemIds, []);
  assert.deepEqual(store.getSnapshot().error, {
    type: 'save',
    itemIds: ['item-1'],
  });

  storage.setError = undefined;
  assert.equal(await store.toggle('item-1'), 'removed');
  assert.deepEqual(store.getSnapshot().itemIds, []);
  assert.equal(store.getSnapshot().error, null);
});

test('a queued success for another item does not clear an earlier save error', async () => {
  let callCount = 0;
  const storage: FavoriteStorage = {
    getItem: async () => null,
    setItem: async () => {
      callCount += 1;
      if (callCount === 1) throw new Error('item-a failed');
    },
  };
  const store = new FavoriteStore(storage, () => 0, () => 0);
  await store.initialize();

  const itemA = store.toggle('item-a');
  const itemB = store.toggle('item-b');
  assert.deepEqual(await Promise.all([itemA, itemB]), ['failed', 'added']);
  assert.deepEqual(store.getSnapshot().itemIds, ['item-b']);
  assert.deepEqual(store.getSnapshot().error, {
    type: 'save',
    itemIds: ['item-a'],
  });
});

test('keeps every failed item when queued writes both fail', async () => {
  const storage: FavoriteStorage = {
    getItem: async () => null,
    setItem: async () => {
      throw new Error('write failed');
    },
  };
  const store = new FavoriteStore(storage, () => 0, () => 0);
  await store.initialize();

  assert.deepEqual(
    await Promise.all([store.toggle('item-a'), store.toggle('item-b')]),
    ['failed', 'failed'],
  );
  assert.deepEqual(store.getSnapshot().error, {
    type: 'save',
    itemIds: ['item-a', 'item-b'],
  });
});

test('accepts input and preserves newest order when the wall clock moves backward', async () => {
  const storage = new MemoryStorage();
  let wallClock = 1_000;
  let monotonicClock = 0;
  const store = new FavoriteStore(
    storage,
    () => wallClock,
    () => monotonicClock,
  );
  await store.initialize();

  assert.equal(await store.toggle('item-a'), 'added');
  wallClock = 500;
  monotonicClock = 500;
  assert.equal(await store.toggle('item-a'), 'removed');
  monotonicClock = 1_000;
  assert.equal(await store.toggle('item-a'), 'added');
  monotonicClock = 1_500;
  assert.equal(await store.toggle('item-b'), 'added');

  const restoredStore = new FavoriteStore(storage);
  await restoredStore.initialize();
  assert.deepEqual(restoredStore.getSnapshot().itemIds, ['item-b', 'item-a']);
});

test('shows a load error and retries the same storage', async () => {
  const storage = new MemoryStorage(JSON.stringify(['item-1']));
  storage.getError = new Error('read failed');
  const store = new FavoriteStore(storage);

  await store.initialize();
  assert.equal(store.getSnapshot().status, 'error');
  assert.deepEqual(store.getSnapshot().error, { type: 'load' });

  storage.getError = undefined;
  await store.retryLoad();
  assert.equal(store.getSnapshot().status, 'ready');
  assert.deepEqual(store.getSnapshot().itemIds, ['item-1']);
});

test('excludes saved IDs that no longer resolve without changing stored IDs', () => {
  const items = new Map([
    ['item-1', { id: 'item-1' }],
    ['item-2', { id: 'item-2' }],
  ]);

  const resolved = resolveFavoriteItems(
    ['item-2', 'missing-item', 'item-1'],
    (itemId) => items.get(itemId),
  );

  assert.deepEqual(resolved, [{ id: 'item-2' }, { id: 'item-1' }]);
});
