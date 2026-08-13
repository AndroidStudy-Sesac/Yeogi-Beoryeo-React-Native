import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { parseItemGuides, parseSynonyms } from './catalog.ts';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as unknown;
}

test('bundled item guide data has valid required fields', () => {
  const items = parseItemGuides(readJson('./data/item_disposal_guides.json'));

  assert.equal(items.length, 730);
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
});

test('bundled synonyms have valid aliases and targets', () => {
  const synonyms = parseSynonyms(readJson('./data/synonyms.json'));

  assert.ok(Object.keys(synonyms).length > 0);
  assert.equal(synonyms.휴대폰, '핸드폰');
});

test('missing required fields fail validation', () => {
  assert.throws(
    () =>
      parseItemGuides([
        {
          id: 'item-1',
          name: '종이',
          categoryPaths: [['재활용폐기물', '종이']],
          similarItems: [],
          dischargeMethods: [],
          features: [],
        },
      ]),
    /items\[0\]\.notes must be an array/,
  );
});
