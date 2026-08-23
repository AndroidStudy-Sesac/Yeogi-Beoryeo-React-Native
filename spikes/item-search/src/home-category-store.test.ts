import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HomeCategoryStore,
  type HomeCategoryStorage,
} from './home-category-store.ts';

const knownIds = ['paper', 'plastic', 'glass', 'metal'];

class MemoryStorage implements HomeCategoryStorage {
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
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test('restores known unique IDs in saved order and ignores corrupt data', async () => {
  const storage = new MemoryStorage(
    JSON.stringify(['plastic', 'missing', 'paper', 'plastic', 3]),
  );
  const store = new HomeCategoryStore(storage, knownIds);

  await store.initialize();
  assert.deepEqual(store.getSnapshot().selectedIds, ['plastic', 'paper']);

  for (const value of ['not-json', JSON.stringify({ selectedIds: ['paper'] })]) {
    const corruptStore = new HomeCategoryStore(new MemoryStorage(value), knownIds);
    await corruptStore.initialize();
    assert.equal(corruptStore.getSnapshot().status, 'ready');
    assert.deepEqual(corruptStore.getSnapshot().selectedIds, []);
  }
});

test('serializes different IDs and rechecks the selection limit against committed state', async () => {
  const firstWrite = deferred<void>();
  const storage: HomeCategoryStorage = {
    getItem: async () => null,
    setItem: async (_key, value) => {
      if (value === JSON.stringify(['paper'])) await firstWrite.promise;
    },
  };
  const store = new HomeCategoryStore(storage, knownIds, () => 0);
  await store.initialize();

  const paper = store.toggle('paper', 1);
  const plastic = store.toggle('plastic', 1);
  assert.deepEqual(store.getSnapshot().pendingIds, ['paper', 'plastic']);

  firstWrite.resolve();
  assert.deepEqual(await Promise.all([paper, plastic]), [
    'selected',
    'limit-reached',
  ]);
  assert.deepEqual(store.getSnapshot().selectedIds, ['paper']);
  assert.deepEqual(store.getSnapshot().pendingIds, []);
});

test('appends selections, removes them, and blocks the same ID for 500 ms', async () => {
  const storage = new MemoryStorage();
  let now = 0;
  const store = new HomeCategoryStore(storage, knownIds, () => now);
  await store.initialize();

  assert.equal(await store.toggle('paper', 2), 'selected');
  now = 500;
  assert.equal(await store.toggle('plastic', 2), 'selected');
  assert.deepEqual(store.getSnapshot().selectedIds, ['paper', 'plastic']);

  now = 999;
  assert.equal(await store.toggle('plastic', 2), 'ignored');
  now = 1_000;
  assert.equal(await store.toggle('plastic', 2), 'deselected');
  assert.deepEqual(store.getSnapshot().selectedIds, ['paper']);
});

test('trims and persists the first IDs when the viewport limit shrinks', async () => {
  const storage = new MemoryStorage(
    JSON.stringify(['paper', 'plastic', 'glass']),
  );
  const store = new HomeCategoryStore(storage, knownIds);
  await store.initialize();

  assert.equal(await store.limit(2), 'trimmed');
  assert.deepEqual(store.getSnapshot().selectedIds, ['paper', 'plastic']);

  const restoredStore = new HomeCategoryStore(storage, knownIds);
  await restoredStore.initialize();
  assert.deepEqual(restoredStore.getSnapshot().selectedIds, [
    'paper',
    'plastic',
  ]);
});

test('shows a load error and retries the same storage', async () => {
  const storage = new MemoryStorage(JSON.stringify(['paper']));
  storage.getError = new Error('read failed');
  const store = new HomeCategoryStore(storage, knownIds);

  await store.initialize();
  assert.equal(store.getSnapshot().status, 'error');
  assert.deepEqual(store.getSnapshot().error, { type: 'load' });

  storage.getError = undefined;
  await store.retryLoad();
  assert.equal(store.getSnapshot().status, 'ready');
  assert.deepEqual(store.getSnapshot().selectedIds, ['paper']);
});

test('keeps committed state after a failed toggle and retries the save', async () => {
  const storage = new MemoryStorage();
  const store = new HomeCategoryStore(storage, knownIds, () => 0);
  await store.initialize();
  storage.setError = new Error('write failed');

  assert.equal(await store.toggle('paper', 2), 'failed');
  assert.deepEqual(store.getSnapshot().selectedIds, []);
  assert.deepEqual(store.getSnapshot().error, {
    type: 'save',
    categoryIds: ['paper'],
  });

  storage.setError = undefined;
  assert.equal(await store.retrySave(), 'saved');
  assert.deepEqual(store.getSnapshot().selectedIds, ['paper']);
  assert.equal(store.getSnapshot().error, null);
});

test('retries a failed viewport trim without losing the previous state', async () => {
  const storage = new MemoryStorage(
    JSON.stringify(['paper', 'plastic', 'glass']),
  );
  const store = new HomeCategoryStore(storage, knownIds);
  await store.initialize();
  storage.setError = new Error('write failed');

  assert.equal(await store.limit(1), 'failed');
  assert.deepEqual(store.getSnapshot().selectedIds, [
    'paper',
    'plastic',
    'glass',
  ]);
  assert.deepEqual(store.getSnapshot().error, {
    type: 'save',
    categoryIds: ['plastic', 'glass'],
  });

  storage.setError = undefined;
  assert.equal(await store.retrySave(), 'saved');
  assert.deepEqual(store.getSnapshot().selectedIds, ['paper']);
  assert.equal(store.getSnapshot().error, null);
});

test('ignores a stale failed viewport limit after the latest limit grows', async () => {
  const firstWrite = deferred<void>();
  let writeCount = 0;
  let value = JSON.stringify(['paper', 'plastic', 'glass', 'metal']);
  const storage: HomeCategoryStorage = {
    getItem: async () => value,
    setItem: async (_key, nextValue) => {
      writeCount += 1;
      if (writeCount === 1) {
        await firstWrite.promise;
        throw new Error('stale trim failed');
      }
      value = nextValue;
    },
  };
  const store = new HomeCategoryStore(storage, knownIds);
  await store.initialize();

  const shrink = store.limit(2);
  const grow = store.limit(4);
  firstWrite.resolve();

  assert.deepEqual(await Promise.all([shrink, grow]), [
    'unchanged',
    'unchanged',
  ]);
  assert.equal(await store.retrySave(), 'ignored');
  assert.deepEqual(store.getSnapshot().selectedIds, [
    'paper',
    'plastic',
    'glass',
    'metal',
  ]);
  assert.equal(value, JSON.stringify(['paper', 'plastic', 'glass', 'metal']));
});

test('restores the latest viewport state after a stale trim succeeds', async () => {
  const firstWrite = deferred<void>();
  let writeCount = 0;
  let value = JSON.stringify(['paper', 'plastic', 'glass', 'metal']);
  const storage: HomeCategoryStorage = {
    getItem: async () => value,
    setItem: async (_key, nextValue) => {
      writeCount += 1;
      if (writeCount === 1) await firstWrite.promise;
      value = nextValue;
    },
  };
  const store = new HomeCategoryStore(storage, knownIds);
  await store.initialize();

  const shrink = store.limit(2);
  const grow = store.limit(4);
  firstWrite.resolve();
  await Promise.all([shrink, grow]);

  assert.deepEqual(store.getSnapshot().selectedIds, [
    'paper',
    'plastic',
    'glass',
    'metal',
  ]);
  assert.equal(value, JSON.stringify(['paper', 'plastic', 'glass', 'metal']));
});

test('retries failed selections in their original input order', async () => {
  let writeCount = 0;
  const storage = new MemoryStorage();
  storage.setItem = async (_key, value) => {
    writeCount += 1;
    storage.setCalls.push(value);
    if (writeCount === 1) throw new Error('first write failed');
    storage.value = value;
  };
  const store = new HomeCategoryStore(storage, knownIds, () => 0);
  await store.initialize();

  const paper = store.toggle('paper', 2);
  const plastic = store.toggle('plastic', 2);
  assert.equal(await paper, 'failed');
  const retry = store.retrySave();
  assert.equal(await plastic, 'failed');
  assert.equal(await retry, 'saved');
  assert.deepEqual(store.getSnapshot().selectedIds, ['paper', 'plastic']);
  assert.equal(storage.value, JSON.stringify(['paper', 'plastic']));
});

test('keeps the first failed selection when retries reach the limit', async () => {
  let writeCount = 0;
  const storage = new MemoryStorage();
  storage.setItem = async (_key, value) => {
    writeCount += 1;
    storage.setCalls.push(value);
    if (writeCount === 1) throw new Error('first write failed');
    storage.value = value;
  };
  const store = new HomeCategoryStore(storage, knownIds, () => 0);
  await store.initialize();

  await Promise.all([
    store.toggle('paper', 1),
    store.toggle('plastic', 1),
  ]);
  assert.equal(await store.retrySave(), 'saved');
  assert.deepEqual(store.getSnapshot().selectedIds, ['paper']);
  assert.equal(storage.value, JSON.stringify(['paper']));
});
