import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { parseItemGuides } from './catalog.ts';
import {
  filterHomeQuickCategories,
  getQuickCategoryGridMetrics,
  homeQuickCategories,
  orderHomeQuickCategories,
  resolveRepresentativeItemId,
} from './item-home.ts';
import { usefulGuides } from './useful-guides.ts';

const items = parseItemGuides(
  JSON.parse(
    readFileSync(
      new URL('./data/item_disposal_guides.json', import.meta.url),
      'utf8',
    ),
  ) as unknown,
);

test('all home categories have unique IDs and resolve a bundled representative item', () => {
  assert.equal(homeQuickCategories.length, 19);
  assert.equal(
    new Set(homeQuickCategories.map((category) => category.id)).size,
    homeQuickCategories.length,
  );

  for (const quickCategory of homeQuickCategories) {
    const itemId = resolveRepresentativeItemId(quickCategory, items);
    assert.ok(itemId, `${quickCategory.label} must resolve an item`);
    assert.ok(items.some((item) => item.id === itemId));
  }
});

test('an exact representative ID wins before a category-path fallback', () => {
  const paper = homeQuickCategories[0];
  assert.ok(paper);
  assert.equal(resolveRepresentativeItemId(paper, items), 'item-guide-0001');

  const plastic = homeQuickCategories.find((category) => category.id === 'plastic');
  assert.ok(plastic);
  assert.notEqual(resolveRepresentativeItemId(plastic, items), plastic.representativeItemId);
});

test('grid metrics reserve one cell for more or collapse across viewport sizes', () => {
  assert.deepEqual(getQuickCategoryGridMetrics(390, 844), {
    columnCount: 4,
    collapsedCategoryCount: 7,
  });
  assert.deepEqual(getQuickCategoryGridMetrics(844, 390), {
    columnCount: 6,
    collapsedCategoryCount: 5,
  });
  assert.deepEqual(getQuickCategoryGridMetrics(500, 800), {
    columnCount: 5,
    collapsedCategoryCount: 9,
  });
});

test('useful guides expose unique IDs and secure external links', () => {
  assert.equal(usefulGuides.length, 4);
  assert.equal(
    new Set(usefulGuides.map((guide) => guide.id)).size,
    usefulGuides.length,
  );
  assert.ok(
    usefulGuides.every((guide) =>
      guide.sites.every((site) => site.url.startsWith('https://')),
    ),
  );
});

test('home category search ignores whitespace and returns no duplicates', () => {
  const electronics = homeQuickCategories.find(
    (category) => category.id === 'electronics',
  );
  assert.ok(electronics);

  assert.deepEqual(
    filterHomeQuickCategories('전기 전자 제품', [electronics, electronics]).map(
      (category) => category.id,
    ),
    ['electronics'],
  );
  assert.deepEqual(filterHomeQuickCategories('없는 분류'), []);
});

test('selected home categories lead in saved order without duplicates', () => {
  const ordered = orderHomeQuickCategories([
    'electronics',
    'battery',
    'electronics',
    'missing',
  ]);

  assert.deepEqual(
    ordered.slice(0, 2).map((category) => category.id),
    ['electronics', 'battery'],
  );
  assert.equal(ordered.length, homeQuickCategories.length);
  assert.equal(
    new Set(ordered.map((category) => category.id)).size,
    homeQuickCategories.length,
  );
});
