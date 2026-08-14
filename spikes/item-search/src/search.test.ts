import assert from 'node:assert/strict';
import test from 'node:test';

import type { ItemGuide } from './catalog.ts';
import { searchItemGuides } from './search.ts';

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
