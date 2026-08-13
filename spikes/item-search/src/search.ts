import type { ItemGuide } from './catalog.ts';

type RankedItem = Readonly<{ item: ItemGuide; rank: number }>;

export function normalizeSearchText(value: string): string {
  return value.replace(/\s/gu, '');
}

function rankItem(item: ItemGuide, query: string): number | undefined {
  const name = normalizeSearchText(item.name).toLocaleLowerCase('ko-KR');
  const similarItems = item.similarItems.map((similarItem) =>
    normalizeSearchText(similarItem).toLocaleLowerCase('ko-KR'),
  );
  const normalizedQuery = query.toLocaleLowerCase('ko-KR');

  if (name === normalizedQuery) return 0;
  if (name.startsWith(normalizedQuery)) return 1;
  if (name.includes(normalizedQuery)) return 2;
  if (similarItems.some((similarItem) => similarItem === normalizedQuery)) return 3;
  if (similarItems.some((similarItem) => similarItem.startsWith(normalizedQuery))) return 4;
  if (similarItems.some((similarItem) => similarItem.includes(normalizedQuery))) return 5;
  return undefined;
}

function isEligible(rank: number, bestRank: number): boolean {
  if (bestRank === 0) return rank === 0;
  if (bestRank === 1 || bestRank === 2) return rank === 1 || rank === 2;
  if (bestRank === 3) return rank === 3;
  return rank === 4 || rank === 5;
}

function searchDirect(items: readonly ItemGuide[], query: string): ItemGuide[] {
  const rankedItems: RankedItem[] = items.flatMap((item) => {
    const rank = rankItem(item, query);
    return rank === undefined ? [] : [{ item, rank }];
  });
  const bestRank = rankedItems.reduce(
    (best, rankedItem) => Math.min(best, rankedItem.rank),
    Number.POSITIVE_INFINITY,
  );
  const seenIds = new Set<string>();

  return rankedItems
    .filter((rankedItem) => isEligible(rankedItem.rank, bestRank))
    .sort(
      (left, right) =>
        left.rank - right.rank || left.item.name.localeCompare(right.item.name, 'ko-KR'),
    )
    .map((rankedItem) => rankedItem.item)
    .filter((item) => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });
}

export function searchItemGuides(
  items: readonly ItemGuide[],
  synonyms: Readonly<Record<string, string>>,
  query: string,
): ItemGuide[] {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length === 0) return [];

  const directResults = searchDirect(items, normalizedQuery);
  if (directResults.length > 0) return directResults;

  const resolvedQuery = normalizeSearchText(synonyms[normalizedQuery] ?? normalizedQuery);
  return resolvedQuery === normalizedQuery ? [] : searchDirect(items, resolvedQuery);
}
