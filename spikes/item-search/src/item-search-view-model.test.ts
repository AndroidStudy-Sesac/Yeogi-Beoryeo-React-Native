import assert from 'node:assert/strict';
import test from 'node:test';

import type { ItemGuide } from './catalog.ts';
import { ItemSearchViewModel, type SearchCatalog } from './item-search-view-model.ts';

function item(name: string): ItemGuide {
  return {
    id: name,
    name,
    legacyNames: [],
    categoryPaths: [['기타']],
    similarItems: [],
    dischargeMethods: [],
    features: [],
    notes: [],
  };
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

test('editing query does not replace the query that produced results', async () => {
  const viewModel = new ItemSearchViewModel(async () => [item('종이')]);
  viewModel.setQuery('종이');
  await viewModel.search();
  viewModel.setQuery('종이컵');

  assert.equal(viewModel.getSnapshot().query, '종이컵');
  assert.equal(viewModel.getSnapshot().submittedQuery, '종이');
  assert.equal(viewModel.getSnapshot().results[0]?.name, '종이');
});

test('a new search aborts the previous request and ignores its late result', async () => {
  const first = deferred<readonly ItemGuide[]>();
  const second = deferred<readonly ItemGuide[]>();
  const signals: AbortSignal[] = [];
  let callCount = 0;
  const search: SearchCatalog = (_query, signal) => {
    signals.push(signal);
    callCount += 1;
    return callCount === 1 ? first.promise : second.promise;
  };
  const viewModel = new ItemSearchViewModel(search);

  viewModel.setQuery('첫 검색');
  const firstSearch = viewModel.search();
  viewModel.setQuery('최신 검색');
  const secondSearch = viewModel.search();
  assert.equal(signals[0]?.aborted, true);

  first.resolve([item('늦은 결과')]);
  await firstSearch;
  assert.equal(viewModel.getSnapshot().submittedQuery, '최신 검색');
  assert.equal(viewModel.getSnapshot().status, 'loading');

  second.resolve([item('최신 결과')]);
  await secondSearch;
  assert.equal(viewModel.getSnapshot().results[0]?.name, '최신 결과');
});

test('cancelling a search resets state without showing an error', async () => {
  const pending = deferred<readonly ItemGuide[]>();
  const viewModel = new ItemSearchViewModel(() => pending.promise);
  viewModel.setQuery('종이');
  const search = viewModel.search();

  viewModel.clearSearch();
  pending.reject(new Error('cancelled request'));
  await search;

  assert.deepEqual(viewModel.getSnapshot(), {
    query: '',
    submittedQuery: '',
    status: 'idle',
    results: [],
  });
});

test('failed searches retry the same query and block duplicate retries', async () => {
  const retryResult = deferred<readonly ItemGuide[]>();
  let callCount = 0;
  const viewModel = new ItemSearchViewModel(() => {
    callCount += 1;
    return callCount === 1
      ? Promise.reject(new Error('load failed'))
      : retryResult.promise;
  });
  viewModel.setQuery('유리병');
  await viewModel.search();

  const firstRetry = viewModel.retry();
  const duplicateRetry = viewModel.retry();
  assert.equal(callCount, 2);

  retryResult.resolve([item('유리병')]);
  await Promise.all([firstRetry, duplicateRetry]);
  assert.equal(viewModel.getSnapshot().status, 'results');
});

test('detail navigation is emitted as a repeatable one-shot event', () => {
  const viewModel = new ItemSearchViewModel(async () => []);
  const events: string[] = [];
  const unsubscribe = viewModel.subscribeToEvents((event) => events.push(event.itemId));

  viewModel.openDetail('item-1');
  viewModel.openDetail('item-1');
  unsubscribe();
  viewModel.openDetail('item-2');

  assert.deepEqual(events, ['item-1', 'item-1']);
});
