/// <reference types="node" />

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import rawItems from './assets/item_disposal_guides.json';
import rawSynonyms from './assets/synonyms.json';
import { loadItemCatalog, parseItemGuides, parseSynonyms } from './itemCatalog';

describe('pinned Android v1.1.0 assets', () => {
  test.each([
    ['item_disposal_guides.json', '3b699c11b87f547ffdf0b17cc3bc81a52f7c739d25d89dc60a0789ea86898a4f'],
    ['synonyms.json', '23cd3ffced5d352f62edae2d929c6bc77cbde483c36db41618d382bf19fb8cfd'],
  ])('preserves source commit b3b7db1 bytes: %s', (filename, expectedHash) => {
    const bytes = readFileSync(join(__dirname, 'assets', filename));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(expectedHash);
  });

  test('validates all 730 guides and 35 aliases without losing detail fields', () => {
    const items = parseItemGuides(rawItems);
    expect(items).toHaveLength(730);
    expect(new Set(items.map(({ id }) => id)).size).toBe(730);
    expect(items).toEqual(rawItems.map((item) => ({ ...item, legacyNames: item.legacyNames ?? [] })));
    expect(Object.keys(parseSynonyms(rawSynonyms))).toHaveLength(35);
  });

  test('reuses one catalog and resolves every stable ID to the full original detail', () => {
    const catalog = loadItemCatalog();
    expect(loadItemCatalog()).toBe(catalog);
    for (const source of rawItems) {
      expect(catalog.getItemGuide(source.id)).toEqual({ ...source, legacyNames: source.legacyNames ?? [] });
      expect(catalog.search(source.name).map(({ id }) => id)).toContain(source.id);
    }
  });

  test('preserves legacy exact lookup and typo synonym fallback', () => {
    const catalog = loadItemCatalog();
    expect(catalog.getItemGuide('종이 컵라면')?.id).toBe('item-guide-0351');
    expect(catalog.getItemGuide('종이컵라면')).toBeNull();
    expect(catalog.search('스트로폼')).toEqual(catalog.search('스티로폼'));
    expect(catalog.search('스트로폼').length).toBeGreaterThan(0);
  });

  // Expected IDs were recorded from the pinned source before this implementation.
  test.each([
    ['pmp', ['item-guide-0098']],
    ['건전지', ['item-guide-0630', 'item-guide-0143', 'item-guide-0142']],
    ['뽁뽁이', ['item-guide-0232']],
    ['스트로폼', ['item-guide-0628', 'item-guide-0626', 'item-guide-0627', 'item-guide-0139', 'item-guide-0141']],
    ['종이 컵라면', ['item-guide-0351']],
    ['종이컵라면 용기', ['item-guide-0351']],
    ['컵라면 용기（종이）', ['item-guide-0351']],
    ['컵라면 용기 종이', ['item-guide-0351']],
    ['냄비뚜껑 내열', ['item-guide-0023']],
    ['냄비뚜껑（내열）', ['item-guide-0023']],
    ['택배 박스 스티로폼', ['item-guide-0141']],
    ['ㄱㅈㅈ', []],
    ['존재하지않는품목', []],
  ] as const)('matches the recorded full result order for %s', (query, expectedIds) => {
    expect(loadItemCatalog().search(query).map(({ id }) => id)).toEqual(expectedIds);
  });
});

describe('asset boundary validation', () => {
  const valid = {
    id: 'a', name: '종이', categoryPaths: [['재활용폐기물', '종이']],
    similarItems: [], dischargeMethods: ['종이류로 배출합니다.'], features: [], notes: [],
  };

  test.each([null, {}, '[]', 0])('rejects non-array guide data: %j', (value) => {
    expect(() => parseItemGuides(value)).toThrow('items must be an array');
  });

  test.each([null, [], 'item'])('rejects malformed item objects: %j', (value) => {
    expect(() => parseItemGuides([value])).toThrow('items[0] must be an object');
  });

  test.each([
    ['id', undefined], ['id', ' '], ['name', 1], ['name', ''], ['categoryPaths', []],
    ['categoryPaths', [[]]], ['categoryPaths', [[' ']]], ['categoryPaths', '종이'],
    ['similarItems', undefined], ['similarItems', [1]], ['dischargeMethods', null],
    ['features', {}], ['notes', ['']], ['legacyNames', null],
  ])('rejects invalid %s (%j) with its location', (field, value) => {
    expect(() => parseItemGuides([{ ...valid, [field]: value }])).toThrow(`items[0].${field}`);
  });

  test('rejects duplicate stable IDs before building the index', () => {
    expect(() => parseItemGuides([valid, { ...valid, name: '종이팩' }])).toThrow('items[1].id duplicates a');
  });

  test('copies and freezes data so later mutation cannot invalidate a cached index', () => {
    const input = { ...valid, categoryPaths: [['종이']], notes: ['안내'] };
    const parsed = parseItemGuides([input]);
    input.categoryPaths[0][0] = '유리';
    input.notes.push('추가');
    expect(parsed[0].categoryPaths).toEqual([['종이']]);
    expect(parsed[0].notes).toEqual(['안내']);
    for (const value of [parsed, parsed[0], parsed[0].categoryPaths, parsed[0].categoryPaths[0], parsed[0].notes]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
  });

  test.each([null, [], 'synonyms', { '': '종이' }, { ' ': '종이' }, { 휴대폰: null }, { 휴대폰: ' ' }])('rejects invalid synonyms: %j', (value) => {
    expect(() => parseSynonyms(value)).toThrow(TypeError);
  });

  test('keeps exact alias spelling and safely stores object-like alias names', () => {
    const input = { '휴 대폰': '핸드폰', constructor: '종이', ['__proto__']: '유리' };
    const synonyms = parseSynonyms(input);
    expect(synonyms).toEqual(input);
    expect(Object.isFrozen(synonyms)).toBe(true);
  });
});
