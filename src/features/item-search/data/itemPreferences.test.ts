import { filterHomeCategories, homeCategories, orderedHomeCategories } from '../domain/homeCategories';
import { loadItemCatalog, loadItemGuide, loadRepresentativeGuides } from './itemCatalog';
import { ITEM_PREFERENCES_KEY, ItemPreferencesStore, parseItemPreferences } from './itemPreferences';

function storage(raw: string | null = null) {
  return { getItem: jest.fn(async () => raw), setItem: jest.fn(async (_key: string, _value: string) => {}) };
}

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('all 19 category routes resolve the original representative guides without changing search', () => {
  expect(loadRepresentativeGuides()).toHaveLength(19);
  for (const category of homeCategories) {
    expect(loadItemGuide(category.guideId)?.name).toBe(category.label);
  }
  expect(loadItemGuide('종이')?.id).toBe('item-guide-0001');
  expect(loadItemGuide('item-guide-0008')?.sections?.find(section => section.title === '품목별 배출 방법')?.rows)
    .toHaveLength(3);
  expect(loadItemCatalog().search('건전지')).toHaveLength(3);
});

test('selected categories retain selection order before the original remaining order', () => {
  expect(orderedHomeCategories(['BATTERY', 'PAPER', 'BATTERY']).slice(0, 4).map(category => category.id))
    .toEqual(['BATTERY', 'PAPER', 'PAPER_PACK', 'COLORLESS_PET']);
  expect(filterHomeCategories(' 의류 및원단 ').map(category => category.id)).toEqual(['CLOTHING']);
  expect(filterHomeCategories('없는분류')).toEqual([]);
});

test('restores stable IDs, removes duplicates and skips invalid individual entries', () => {
  const result = parseItemPreferences(JSON.stringify({ version: 1,
    categories: ['PAPER', 'INVALID', 'PAPER', 'BATTERY'], favorites: [
      { id: '종이', savedAt: 10 }, { id: 'item-guide-0001', savedAt: 20 },
      { id: 'item-guide-0010', savedAt: 30 }, { id: 'missing', savedAt: 40 },
      { id: 'item-guide-0002', savedAt: -1 }, null,
    ],
  }));
  expect(result.categories).toEqual(['PAPER', 'BATTERY']);
  expect(result.favorites).toEqual([{ id: 'item-guide-0010', savedAt: 30 }, { id: 'item-guide-0001', savedAt: 20 }]);
});

test.each(['broken json', '{"version":2,"categories":[],"favorites":[]}'])('does not overwrite unreadable storage: %s', async raw => {
  const backend = storage(raw);
  const store = new ItemPreferencesStore(backend);
  await store.load();
  expect(store.getSnapshot().status).toBe('error');
  expect(await store.toggleFavorite('item-guide-0001')).toBe(false);
  expect(backend.setItem).not.toHaveBeenCalled();
  backend.getItem.mockResolvedValue(null);
  await store.load();
  expect(store.getSnapshot().status).toBe('ready');
});

test('blocks edits before restore and retries a failed read', async () => {
  const backend = storage();
  const store = new ItemPreferencesStore(backend);
  expect(await store.toggleCategory('PAPER', 7)).toBe(false);
  backend.getItem.mockRejectedValueOnce(new Error('read failure'));
  await store.load();
  expect(store.getSnapshot().status).toBe('error');
  await store.load();
  expect(store.getSnapshot().status).toBe('ready');
});

test('commits A and releases its button while B is still pending, then permits removing A', async () => {
  const backend = storage();
  const a = deferred();
  const b = deferred();
  backend.setItem.mockImplementationOnce(() => a.promise).mockImplementationOnce(() => b.promise);
  const store = new ItemPreferencesStore(backend, () => 100);
  await store.load();
  const saveA = store.toggleFavorite('item-guide-0001');
  const saveB = store.toggleFavorite('item-guide-0002');
  expect(await store.toggleFavorite('item-guide-0001')).toBe(false);
  a.resolve();
  await saveA;
  expect(store.getSnapshot().data.favorites.map(item => item.id)).toEqual(['item-guide-0001']);
  expect(store.getSnapshot().pending).toEqual(['item-guide-0002']);
  const removeA = store.toggleFavorite('item-guide-0001');
  b.resolve();
  await Promise.all([saveB, removeA]);
  expect(store.getSnapshot().data.favorites.map(item => item.id)).toEqual(['item-guide-0002']);
  const persisted = backend.setItem.mock.calls.at(-1)!;
  expect(persisted[0]).toBe(ITEM_PREFERENCES_KEY);
  const relaunched = new ItemPreferencesStore(storage(persisted[1]));
  await relaunched.load();
  expect(relaunched.getSnapshot().data).toEqual(store.getSnapshot().data);
});

test('a failed write preserves committed state and later queued writes remain valid', async () => {
  const backend = storage();
  const store = new ItemPreferencesStore(backend);
  await store.load();
  await store.toggleFavorite('item-guide-0001');
  backend.setItem.mockRejectedValueOnce(new Error('disk full'));
  const failed = store.removeFavorite('item-guide-0001');
  const succeeds = store.toggleFavorite('item-guide-0002');
  expect(await failed).toBe(false);
  await succeeds;
  expect(store.getSnapshot().data.favorites.map(item => item.id)).toEqual(['item-guide-0002', 'item-guide-0001']);
  expect(store.getSnapshot().writeError).toBe(true);
  await store.removeFavorite('item-guide-0001');
  expect(store.getSnapshot().data.favorites.map(item => item.id)).toEqual(['item-guide-0002']);
});

test('applies category limits in write order and persists selection changes', async () => {
  const backend = storage();
  const store = new ItemPreferencesStore(backend);
  await store.load();
  await Promise.all([store.toggleCategory('BATTERY', 2), store.toggleCategory('PAPER', 2), store.toggleCategory('METAL', 2)]);
  expect(store.getSnapshot().data.categories).toEqual(['BATTERY', 'PAPER']);
  await store.toggleCategory('BATTERY', 2);
  await store.toggleCategory('METAL', 2);
  expect(store.getSnapshot().data.categories).toEqual(['PAPER', 'METAL']);
  await store.limitCategories(1);
  expect(store.getSnapshot().data.categories).toEqual(['PAPER']);
});

test('keeps timestamp order stable across relaunch when the device clock moves backwards', async () => {
  const backend = storage();
  const now = jest.fn().mockReturnValueOnce(200).mockReturnValueOnce(100);
  const store = new ItemPreferencesStore(backend, now);
  await store.load();
  await store.toggleFavorite('item-guide-0001');
  await store.toggleFavorite('item-guide-0002');
  expect(store.getSnapshot().data.favorites.map(item => item.id)).toEqual(['item-guide-0001', 'item-guide-0002']);
  const raw = backend.setItem.mock.calls.at(-1)![1];
  expect(parseItemPreferences(raw).favorites).toEqual(store.getSnapshot().data.favorites);
});
