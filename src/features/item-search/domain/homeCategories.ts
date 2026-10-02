const definitions = [
  ['PAPER', '종이'], ['PAPER_PACK', '종이팩'], ['COLORLESS_PET', '무색페트병'],
  ['PLASTIC', '플라스틱류'], ['VINYL', '비닐류'], ['STYROFOAM', '발포합성수지'],
  ['GLASS', '유리병'], ['METAL', '금속류'], ['CLOTHING', '의류 및 원단'],
  ['BATTERY', '전지'], ['LIGHTING', '조명제품'], ['ELECTRONICS', '전기전자제품'],
  ['FOOD_WASTE', '음식물류폐기물'], ['GENERAL', '일반종량제폐기물'],
  ['NON_COMBUSTIBLE', '불연성종량제폐기물'], ['LARGE_WASTE', '대형폐기물'],
  ['CONSTRUCTION_WASTE', '공사장 생활폐기물'], ['HAZARDOUS', '생활계 유해폐기물'], ['OTHER', '기타'],
] as const;

export type HomeCategoryId = typeof definitions[number][0];
export const homeCategories = definitions.map(([id, label], index) => ({
  id, label, guideId: `item-guide-${String(index + 1).padStart(4, '0')}`,
}));

export function orderedHomeCategories(selected: readonly HomeCategoryId[]) {
  const ids = [...new Set(selected)];
  return [...ids.flatMap(id => homeCategories.filter(category => category.id === id)),
    ...homeCategories.filter(category => !ids.includes(category.id))];
}

export function filterHomeCategories(keyword: string) {
  const key = keyword.replace(/\s/gu, '').toLowerCase();
  return homeCategories.filter(category => category.label.replace(/\s/gu, '').toLowerCase().includes(key));
}
