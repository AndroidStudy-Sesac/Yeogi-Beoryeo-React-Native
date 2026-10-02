import type { ItemGuide } from '../domain/itemGuide';

export const itemCategories = {
  paper: '종이', paper_pack: '종이팩', colorless_pet: '무색페트병', glass_bottle: '유리병',
  metal: '금속류', plastic: '플라스틱류', styrofoam: '발포합성수지', vinyl: '비닐류',
  food_waste: '음식물류폐기물', large_waste: '대형폐기물', electronics: '전기전자제품',
  battery: '전지', lighting: '조명제품', clothing: '의류 및 원단', hazardous: '생활계 유해폐기물',
  non_combustible: '불연성종량제폐기물', construction_waste: '공사장 생활폐기물',
  general_waste: '일반종량제폐기물', other: '기타',
} as const;

export type ItemCategory = keyof typeof itemCategories;

export function getItemCategory(guide: ItemGuide): ItemCategory {
  const leaves = guide.categoryPaths.map(path => path[path.length - 1]);
  const has = (...labels: string[]) => leaves.some(leaf => labels.includes(leaf));
  if (has('음식물류폐기물')) return 'food_waste';
  if (has('공사장 생활폐기물')) return 'construction_waste';
  if (has('불연성종량제폐기물')) return 'non_combustible';
  if (has('폐의약품', '폐농약', '생활계 유해폐기물', '수은함유 폐기물', '천연방사성제품')) return 'hazardous';
  if (has('무색페트병')) return 'colorless_pet';
  if (has('합성수지 용기류', '합성수지 재질')) return 'plastic';
  if (has('합성수지 비닐류')) return 'vinyl';
  if (has('발포합성수지(스티로폼 등)')) return 'styrofoam';
  if (has('유리병')) return 'glass_bottle';
  if (leaves.some(leaf => leaf.startsWith('금속류'))) return 'metal';
  if (leaves.some(leaf => leaf.startsWith('종이팩'))) return 'paper_pack';
  if (has('종이')) return 'paper';
  if (has('의류 및 원단')) return 'clothing';
  if (has('전지류')) return 'battery';
  if (has('조명제품')) return 'lighting';
  if (has('전기전자 제품류')) return 'electronics';
  if (has('일반종량제폐기물')) return 'general_waste';
  if (has('대형폐기물')) return 'large_waste';
  return 'other';
}

export function getItemDisplay(guide: ItemGuide) {
  const category = getItemCategory(guide);
  const leaves = guide.categoryPaths.map(path => path[path.length - 1]);
  const subcategory = leaves.includes('무색페트병') ? '투명페트병'
    : leaves.includes('금속류 금속캔') ? '알루미늄캔'
      : leaves.includes('금속류 고철') ? '고철'
        : leaves.some(leaf => leaf.startsWith('종이팩')) ? '우유팩' : null;
  const nonRecycling: readonly ItemCategory[] = [
    'food_waste', 'non_combustible', 'construction_waste', 'general_waste', 'other',
  ];
  const disposalRoute = category === 'hazardous' ? '전용 수거'
    : category === 'large_waste' ? '신고 후 배출'
      : nonRecycling.includes(category) ? null : '재활용 분리배출';
  const firstMethod = guide.dischargeMethods[0];

  return {
    category,
    categoryLabel: itemCategories[category],
    subcategory,
    disposalRoute,
    summary: firstMethod === '일반종량제폐기물' ? '종량제봉투' : firstMethod,
    sections: [
      { title: '배출방법', lines: guide.dischargeMethods },
      { title: '특징', lines: guide.features },
      { title: '유의사항', lines: guide.notes },
    ].filter(section => section.lines.length > 0),
  };
}

export function itemText(value: string): string {
  return value.replaceAll('\u00b7', ', ');
}

const materialReadings: Record<string, string> = {
  EPP: '이피피', EPS: '이피에스', EPE: '이피이', EPR: '이피알',
  PP: '피피', PE: '피이', PS: '피에스',
};

export function itemReadableText(value: string): string {
  return itemText(value).replace(/(^|[^A-Za-z])(EPP|EPS|EPE|EPR|PP|PE|PS)(?![A-Za-z])/gi,
    (_match, prefix: string, abbreviation: string) => prefix + materialReadings[abbreviation.toUpperCase()]);
}
