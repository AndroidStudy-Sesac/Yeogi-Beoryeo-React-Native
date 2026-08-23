import type { ItemGuide } from './catalog';

export type HomeQuickCategory = Readonly<{
  id: string;
  label: string;
  matchText: string;
  representativeItemId: string;
  symbol: string;
}>;

export const homeQuickCategories: readonly HomeQuickCategory[] = [
  category('paper', '종이', '종이', 'item-guide-0001', '▤'),
  category('paper-pack', '종이팩', '종이팩', 'item-guide-0002', '▣'),
  category('colorless-pet', '무색페트병', '무색페트병', 'item-guide-0003', '♲'),
  category('plastic', '플라스틱류', '합성수지', 'item-guide-0004', '◆'),
  category('vinyl', '비닐류', '비닐', 'item-guide-0005', '◇'),
  category('styrofoam', '발포합성수지', '발포합성수지', 'item-guide-0006', '▱'),
  category('glass', '유리병', '유리병', 'item-guide-0007', '◉'),
  category('metal', '금속류', '금속류', 'item-guide-0008', '⬡'),
  category('clothing', '의류 및 원단', '의류', 'item-guide-0009', '▧'),
  category('battery', '전지', '전지류', 'item-guide-0010', '▰'),
  category('lighting', '조명제품', '조명제품', 'item-guide-0011', '✦'),
  category('electronics', '전기전자제품', '전기전자', 'item-guide-0012', '⌁'),
  category('food-waste', '음식물류폐기물', '음식물류폐기물', 'item-guide-0013', '●'),
  category('general', '일반종량제폐기물', '일반종량제폐기물', 'item-guide-0014', '■'),
  category('non-combustible', '불연성종량제폐기물', '불연성종량제폐기물', 'item-guide-0015', '▨'),
  category('large-waste', '대형폐기물', '대형폐기물', 'item-guide-0016', '▦'),
  category('construction-waste', '공사장 생활폐기물', '공사장 생활폐기물', 'item-guide-0017', '▩'),
  category('hazardous', '생활계 유해폐기물', '생활계 유해폐기물', 'item-guide-0018', '▲'),
  category('other', '기타', '기타', 'item-guide-0019', '•••'),
];

export type QuickCategoryGridMetrics = Readonly<{
  collapsedCategoryCount: number;
  columnCount: number;
}>;

function category(
  id: string,
  label: string,
  matchText: string,
  representativeItemId: string,
  symbol: string,
): HomeQuickCategory {
  return { id, label, matchText, representativeItemId, symbol };
}

function normalize(value: string): string {
  return value.replace(/\s+/g, '').toLocaleLowerCase('ko-KR');
}

export function filterHomeQuickCategories(
  query: string,
  categories: readonly HomeQuickCategory[] = homeQuickCategories,
): HomeQuickCategory[] {
  const searchKey = normalize(query);
  const seenIds = new Set<string>();

  return categories.filter((category) => {
    if (seenIds.has(category.id)) return false;
    seenIds.add(category.id);
    return (
      searchKey.length === 0 ||
      normalize(category.label).includes(searchKey) ||
      normalize(category.matchText).includes(searchKey)
    );
  });
}

export function orderHomeQuickCategories(
  selectedCategoryIds: readonly string[],
): HomeQuickCategory[] {
  const categoriesById = new Map(
    homeQuickCategories.map((category) => [category.id, category]),
  );
  const selected = [...new Set(selectedCategoryIds)].flatMap((categoryId) => {
    const category = categoriesById.get(categoryId);
    return category === undefined ? [] : [category];
  });
  const selectedIds = new Set(selected.map((category) => category.id));

  return [
    ...selected,
    ...homeQuickCategories.filter((category) => !selectedIds.has(category.id)),
  ];
}

export function resolveRepresentativeItemId(
  quickCategory: HomeQuickCategory,
  items: readonly ItemGuide[],
): string | undefined {
  const exactItem = items.find(
    (item) => item.id === quickCategory.representativeItemId,
  );
  if (exactItem !== undefined) return exactItem.id;

  const matchText = normalize(quickCategory.matchText);
  return items.find((item) =>
    item.categoryPaths.some((path) =>
      path.some((segment) => normalize(segment).includes(matchText)),
    ),
  )?.id;
}

export function getQuickCategoryGridMetrics(
  viewportWidth: number,
  viewportHeight: number,
): QuickCategoryGridMetrics {
  const columnCount = viewportWidth >= 700 ? 6 : viewportWidth >= 460 ? 5 : 4;
  const collapsedRowCount = viewportHeight >= 700 ? 2 : 1;

  return {
    columnCount,
    collapsedCategoryCount: columnCount * collapsedRowCount - 1,
  };
}
