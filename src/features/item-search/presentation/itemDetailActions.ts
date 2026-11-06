import type { ItemGuide } from '../domain/itemGuide';
import strings from './assets/homeStrings.json';
import { getItemCategory, itemText } from './itemDisplay';
import { freePickupUrl } from './usefulGuides';

const spotActions = {
  small_e_waste_bin: 'SMALL_E_WASTE_BIN', standard_bag_store: 'STANDARD_BAG_STORE',
  phone_drop_off: 'PHONE_DROP_OFF', battery_bin: 'BATTERY_BIN', fluorescent_lamp_bin: 'FLUORESCENT_LAMP_BIN',
  clothing_bin: 'CLOTHING_BIN', medicine_drop_box: 'MEDICINE_DROP_BOX', hazardous_waste_bin: 'HAZARDOUS_WASTE_BIN',
  ice_pack_bin: 'ICE_PACK_BIN', waste_cooking_oil_bin: 'WASTE_COOKING_OIL_BIN',
} as const;
export type ItemDetailSpot = typeof spotActions[keyof typeof spotActions];
export type ItemDetailAction = { label: string; description: string } & ({ spot: ItemDetailSpot } | { url: string });

/** Preserve the original v1.1.0 action order and distinction between disposal instructions and cautions. */
export function itemDetailActions(guide: ItemGuide): ItemDetailAction[] {
  const category = getItemCategory(guide);
  const related = guide.relatedSpotTypes ?? [];
  const sections = guide.sections?.flatMap(section => [section.title, ...section.lines,
    ...section.rows.flatMap(row => [row.label, row.value])]) ?? [];
  const disposal = [guide.name, ...guide.dischargeMethods, ...sections].join('').replaceAll(' ', '');
  const text = [disposal, ...guide.features, ...guide.notes].join('').replaceAll(' ', '');
  const actions: ItemDetailAction[] = [];
  const add = (key: keyof typeof spotActions) => {
    const label = `item_guide_action_find_${key}` as keyof typeof strings;
    const description = `${label}_description` as keyof typeof strings;
    actions.push({ spot: spotActions[key], label: itemText(strings[label]), description: itemText(strings[description]) });
  };
  if (related.includes('SMALL_E_WASTE_BIN') || related.includes('E_WASTE_BIN')
    || text.includes('소형전기전자제품') || text.includes('소형폐가전')) add('small_e_waste_bin');
  if (related.includes('GENERAL_WASTE_BAG') || category === 'general_waste') add('standard_bag_store');
  if (guide.name === '핸드폰' || guide.name === '전기전자제품') add('phone_drop_off');
  if (category === 'battery' || text.includes('전지수거함')) add('battery_bin');
  if (category === 'lighting' || text.includes('형광등수거함')) add('fluorescent_lamp_bin');
  if (category === 'clothing' || text.includes('의류수거함')) add('clothing_bin');
  const hazardous = guide.name === '생활계 유해폐기물';
  if (disposal.includes('폐의약품수거함') || disposal.includes('폐의약품전용수거함')
    || (hazardous && disposal.includes('폐의약품') && disposal.includes('전용수거함'))) add('medicine_drop_box');
  if (text.includes('생활계유해폐기물') && text.includes('전용수거함')) add('hazardous_waste_bin');
  if (hazardous || (text.includes('아이스팩') && text.includes('전용수거함'))) add('ice_pack_bin');
  if (hazardous || text.includes('폐식용유수거함')) add('waste_cooking_oil_bin');
  if (related.includes('FREE_PICKUP') || text.includes('무상방문수거서비스')) actions.push({
    url: freePickupUrl, label: itemText(strings.item_guide_action_free_pickup),
    description: itemText(strings.item_guide_action_free_pickup_description),
  });
  return actions;
}
