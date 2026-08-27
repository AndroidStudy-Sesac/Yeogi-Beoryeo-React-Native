import assert from 'node:assert/strict';
import test from 'node:test';

import type { ItemGuide } from './catalog.ts';
import { searchItemGuides } from './search.ts';
import {
  measureSearchPerformance,
  nearestRank,
} from './search-performance.ts';

function item(name: string, similarItems: string[] = [], id = name): ItemGuide {
  return {
    id,
    name,
    legacyNames: [],
    categoryPaths: [['기타']],
    similarItems,
    dischargeMethods: [],
    features: [],
    notes: [],
  };
}

test('blank and whitespace-only queries return no results', () => {
  assert.deepEqual(searchItemGuides([item('종이')], {}, ' \n\t'), []);
});

test('exact name matches exclude lower name ranks', () => {
  const results = searchItemGuides(
    [item('유리병'), item('유리'), item('깨진 유리')],
    {},
    '유 리',
  );

  assert.deepEqual(results.map((result) => result.name), ['유리']);
});

test('prefix and contains name matches share the best name group', () => {
  const results = searchItemGuides(
    [item('소형 전기히터'), item('전기히터'), item('전기장판')],
    {},
    '전기',
  );

  assert.deepEqual(results.map((result) => result.name), [
    '전기장판',
    '전기히터',
    '소형 전기히터',
  ]);
});

test('exact similar-item matches exclude lower similar-item ranks', () => {
  const results = searchItemGuides(
    [item('아이스박스', ['스티로폼 상자']), item('포장 완충재', ['스티로폼'])],
    {},
    '스티로폼',
  );

  assert.deepEqual(results.map((result) => result.name), ['포장 완충재']);
});

test('direct name results win over similar-item results', () => {
  const results = searchItemGuides(
    [item('캔'), item('통조림 용기', ['캔'])],
    {},
    '캔',
  );

  assert.deepEqual(results.map((result) => result.name), ['캔']);
});

test('ASCII names are searched case-insensitively', () => {
  assert.deepEqual(
    searchItemGuides([item('PMP')], {}, 'pmp').map((result) => result.name),
    ['PMP'],
  );
});

test('synonyms run only when the original query has no result', () => {
  const synonyms = { 휴대폰: '핸드폰' };

  assert.deepEqual(
    searchItemGuides([item('핸드폰')], synonyms, '휴대폰').map((result) => result.name),
    ['핸드폰'],
  );
  assert.deepEqual(
    searchItemGuides([item('휴대폰 케이스'), item('핸드폰')], synonyms, '휴대폰').map(
      (result) => result.name,
    ),
    ['휴대폰 케이스'],
  );
});

test('same IDs are deduplicated while same names with different IDs remain', () => {
  const results = searchItemGuides(
    [item('전기히터', [], 'id-1'), item('전기히터', [], 'id-1'), item('전기히터', [], 'id-2')],
    {},
    '전기히터',
  );

  assert.deepEqual(results.map((result) => result.id), ['id-1', 'id-2']);
});

test('repeated searches reuse the normalized item index', () => {
  let nameReads = 0;
  const cachedItem: ItemGuide = {
    id: 'battery',
    get name() {
      nameReads += 1;
      return '건전지';
    },
    legacyNames: [],
    categoryPaths: [['기타']],
    similarItems: ['폐건전지'],
    dischargeMethods: [],
    features: [],
    notes: [],
  };
  const items = [cachedItem];

  searchItemGuides(items, {}, '건전지');
  searchItemGuides(items, {}, '폐건전지');

  assert.equal(nameReads, 1);
});

test('nearest-rank percentiles use sorted sample positions', () => {
  assert.equal(nearestRank([4, 1, 3, 2], 0.5), 2);
  assert.equal(nearestRank([4, 1, 3, 2], 0.95), 4);
});

test('search performance keeps first and repeated measurements separate', () => {
  let time = 0;
  const [measurement] = measureSearchPerformance(
    [item('건전지')],
    {},
    ['건전지'],
    3,
    () => time++,
  );

  assert.deepEqual(measurement, {
    query: '건전지',
    resultCount: 1,
    firstMs: 1,
    p50Ms: 1,
    p95Ms: 1,
    minMs: 1,
    maxMs: 1,
  });
});
