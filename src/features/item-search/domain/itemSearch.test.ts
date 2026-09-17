import type { ItemGuide } from './itemGuide';
import { ItemSearchIndex } from './itemSearch';

function item(name: string, similarItems: readonly string[] = [], id = name): ItemGuide {
  return {
    id, name, similarItems, legacyNames: [], categoryPaths: [['기타']],
    dischargeMethods: [], features: [], notes: [],
  };
}

function names(index: ItemSearchIndex, query: string): readonly string[] {
  return index.search(query).map(({ name }) => name);
}

describe('source Android v1.1.0 search contract', () => {
  test.each(['', ' \n\t', '（ () ）', '\u001c\u00a0\u3000'])('ignores an empty search key: %j', (query) => {
    expect(new ItemSearchIndex([item('종이')], {}).search(query)).toEqual([]);
  });

  test.each(['냄비뚜껑 내열', '냄비뚜껑(내열)', '냄비뚜껑（내열）'])('normalizes parentheses and prefers exact names: %s', (query) => {
    const index = new ItemSearchIndex([item('냄비뚜껑내열판'), item('냄비뚜껑(내열)')], {});
    expect(names(index, query)).toEqual(['냄비뚜껑(내열)']);
  });

  test('keeps prefix and contains names, ordered by rank then original name', () => {
    const index = new ItemSearchIndex([
      item('소형 전기히터'), item('전기히터'), item('전기장판'), item('난방', ['전기']),
    ], {});
    expect(names(index, '전기')).toEqual(['전기장판', '전기히터', '소형 전기히터']);
  });

  test('uses UTF-16 order instead of Korean locale collation', () => {
    const index = new ItemSearchIndex([item('품목a'), item('품목가'), item('품목Z')], {});
    expect(names(index, '품목')).toEqual(['품목Z', '품목a', '품목가']);
  });

  test('excludes similar-name matches when a direct name contains the query', () => {
    const index = new ItemSearchIndex([item('우유팩'), item('스틱봉지', ['삼각커피우유'])], {});
    expect(names(index, '우유')).toEqual(['우유팩']);
  });

  test('prefers exact similar names to lower similar-name ranks', () => {
    const index = new ItemSearchIndex([
      item('아이스박스', ['스티로폼 상자']), item('완충재', ['스티로폼']),
    ], {});
    expect(names(index, '스티로폼')).toEqual(['완충재']);
  });

  test('keeps similar-name prefix and contains matches when no better rank exists', () => {
    const index = new ItemSearchIndex([
      item('완충재', ['포장 스티로폼']), item('아이스박스', ['스티로폼 상자']),
    ], {});
    expect(names(index, '스티로폼')).toEqual(['아이스박스', '완충재']);
  });

  test('normalizes whitespace and parentheses in similar names', () => {
    const index = new ItemSearchIndex([item('아이스박스', ['택배 박스（스티로폼）'])], {});
    expect(names(index, '택배박스(스티로폼)')).toEqual(['아이스박스']);
  });

  test.each([
    ['PMP', 'pmp'], ['태블릿 PC', '태블릿pc'], ['I', 'ı'], ['İ', 'i'], ['Σ', 'ς'], ['ẞ', 'ß'],
  ])('uses Kotlin simple case-insensitive matching: %s / %s', (name, query) => {
    expect(names(new ItemSearchIndex([item(name)], {}), query)).toEqual([name]);
  });

  test('does not expand letters or Hangul initial consonants', () => {
    const index = new ItemSearchIndex([item('ß'), item('페트병')], {});
    expect(index.search('ss')).toEqual([]);
    expect(index.search('ㅍㅌㅂ')).toEqual([]);
  });

  test('resolves one exact synonym only after both name and similar-name search fail', () => {
    const synonyms = { 휴대폰: '핸드폰', 케이스: '휴대폰' };
    const fallback = new ItemSearchIndex([item('핸드폰')], synonyms);
    expect(names(fallback, '휴 대（폰）')).toEqual(['핸드폰']);
    expect(fallback.search('케이스')).toEqual([]);
    const direct = new ItemSearchIndex([item('휴대폰 케이스'), item('핸드폰')], synonyms);
    expect(names(direct, '휴대폰')).toEqual(['휴대폰 케이스']);
    const similar = new ItemSearchIndex([item('케이스', ['휴대폰']), item('핸드폰')], synonyms);
    expect(names(similar, '휴대폰')).toEqual(['케이스']);
  });

  test('keeps synonym key casing and does not use inherited object keys', () => {
    const index = new ItemSearchIndex([item('핸드폰')], { PHONE: '핸드폰' });
    expect(names(index, 'PHONE')).toEqual(['핸드폰']);
    expect(index.search('phone')).toEqual([]);
    expect(index.search('constructor')).toEqual([]);
    expect(index.search('__proto__')).toEqual([]);
  });

  test('returns no results for missing, self-referencing or blank synonym targets', () => {
    const index = new ItemSearchIndex([item('종이')], { 가: '가', 나: '없는품목', 다: '（）' });
    for (const query of ['없는품목', '가', '나', '다']) expect(index.search(query)).toEqual([]);
  });

  test('deduplicates stable IDs while preserving distinct items with the same name', () => {
    const index = new ItemSearchIndex([
      item('전기히터', [], 'a'), item('전기히터', [], 'a'), item('전기히터', [], 'b'),
    ], {});
    expect(index.search('전기히터').map(({ id }) => id)).toEqual(['a', 'b']);
  });

  test('reuses the normalized names across repeated queries', () => {
    const source = item('건전지', ['폐건전지']);
    const name = jest.fn(() => '건전지');
    const similarItems = jest.fn(() => ['폐건전지']);
    const index = new ItemSearchIndex([{ ...source, get name() { return name(); }, get similarItems() { return similarItems(); } }], {});
    expect(names(index, '건전지')).toEqual(['건전지']);
    // Read counts below exclude the result's name, which belongs to the caller.
    name.mockClear();
    index.search('폐건전지');
    index.search('건 전 지');
    expect(name).not.toHaveBeenCalled();
    expect(similarItems).toHaveBeenCalledTimes(1);
  });

  test('looks up exact ID, current name or legacy name without search normalization', () => {
    const guide = { ...item('컵라면 용기(종이)', [], 'item-guide-0351'), legacyNames: ['종이 컵라면'] };
    const index = new ItemSearchIndex([guide], {});
    for (const identifier of [guide.id, guide.name, '종이 컵라면']) {
      expect(index.getItemGuide(identifier)).toBe(guide);
    }
    for (const identifier of ['컵라면', '종이컵라면', 'item-guide-missing', '']) {
      expect(index.getItemGuide(identifier)).toBeNull();
    }
  });

  test('keeps source order for ambiguous exact detail identifiers', () => {
    const first = item('같은 이름', [], 'first');
    const second = item('같은 이름', [], 'second');
    const index = new ItemSearchIndex([first, second], {});
    expect(index.getItemGuide('같은 이름')).toBe(first);
    expect(index.getItemGuide('second')).toBe(second);
  });
});
