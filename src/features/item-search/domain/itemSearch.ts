import type { ItemGuide } from './itemGuide';

type IndexedItem = Readonly<{
  item: ItemGuide;
  sortName: string;
  name: string;
  similarNames: readonly string[];
}>;

function searchKey(value: string): string {
  // Match Kotlin Char.isWhitespace(), plus the source app's two parenthesis forms.
  return value.replace(/[\p{Z}\u0009-\u000d\u001c-\u001f()（）]/gu, '');
}

function ignoreCaseKey(value: string): string {
  // Kotlin compares UTF-16 chars using simple case mappings, without expanding ß to SS.
  return value.replace(/[\s\S]/g, (character) => {
    const upper = character.toUpperCase();
    return (upper.length === 1 ? upper : character).toLowerCase()[0];
  });
}

function matchRank({ name, similarNames }: IndexedItem, query: string): number {
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  if (similarNames.includes(query)) return 3;
  if (similarNames.some((name) => name.startsWith(query))) return 4;
  if (similarNames.some((name) => name.includes(query))) return 5;
  return Infinity;
}

export class ItemSearchIndex {
  private readonly entries: readonly IndexedItem[];
  private readonly synonyms: ReadonlyMap<string, string>;
  private readonly details = new Map<string, ItemGuide>();

  constructor(items: readonly ItemGuide[], synonyms: Readonly<Record<string, string>>) {
    this.entries = items.map((item) => {
      const name = item.name;
      for (const identifier of [item.id, name, ...item.legacyNames]) {
        if (!this.details.has(identifier)) this.details.set(identifier, item);
      }
      return {
        item,
        sortName: name,
        name: ignoreCaseKey(searchKey(name)),
        similarNames: item.similarItems.map((name) => ignoreCaseKey(searchKey(name))),
      };
    });
    this.synonyms = new Map(Object.entries(synonyms));
  }

  search(query: string): readonly ItemGuide[] {
    const key = searchKey(query);
    if (key.length === 0) return [];

    const direct = this.searchDirect(key);
    if (direct.length > 0) return direct;

    // Synonym keys are exact and case-sensitive in the source repository.
    const synonym = this.synonyms.get(key);
    if (synonym === undefined) return [];
    const resolved = searchKey(synonym);
    return resolved === key || resolved.length === 0 ? [] : this.searchDirect(resolved);
  }

  getItemGuide(identifier: string): ItemGuide | null {
    return this.details.get(identifier) ?? null;
  }

  private searchDirect(query: string): readonly ItemGuide[] {
    const key = ignoreCaseKey(query);
    const matches = this.entries
      .map((entry) => ({ entry, rank: matchRank(entry, key) }))
      .filter(({ rank }) => rank !== Infinity);
    const best = matches.reduce((best, { rank }) => Math.min(best, rank), Infinity);
    const seen = new Set<string>();

    return matches
      .filter(({ rank }) => {
        if (best === 0 || best === 3) return rank === best;
        return best < 3 ? rank < 3 : rank >= 4;
      })
      .sort((left, right) => {
        if (left.rank !== right.rank) return left.rank - right.rank;
        // Kotlin String.compareTo uses code-unit order, not locale collation.
        const a = left.entry.sortName;
        const b = right.entry.sortName;
        return a < b ? -1 : a > b ? 1 : 0;
      })
      .flatMap(({ entry: { item } }) => {
        if (seen.has(item.id)) return [];
        seen.add(item.id);
        return [item];
      });
  }
}
