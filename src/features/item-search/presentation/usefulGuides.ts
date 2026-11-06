import strings from './assets/homeStrings.json';
import { itemText } from './itemDisplay';

export type UsefulGuideType = 'SMALL_E_WASTE' | 'REGIONAL_GUIDE' | 'REPRESENTATIVE_CATEGORY' | 'ITEM_DICTIONARY';
const portal = 'https://xn--oy2b29bd3a601b.kr';
export const freePickupUrl = 'https://www.15990903.or.kr/portal/cnts/userGuide.do';
const guideIcons = { SMALL_E_WASTE: 'guide_location', REGIONAL_GUIDE: 'guide_info',
  REPRESENTATIVE_CATEGORY: 'guide_list', ITEM_DICTIONARY: 'action_search' } as const;
const definitions: readonly [UsefulGuideType, string, readonly [keyof typeof strings, string][]][] = [
  ['SMALL_E_WASTE', 'small_e_waste', [
    ['item_useful_guide_site_disposal_home', `${portal}/`],
    ['item_useful_guide_site_pickup_locations', 'https://www.re.or.kr/info/listPickupPage.do'],
  ]],
  ['REGIONAL_GUIDE', 'regional', [
    ['item_useful_guide_site_regional_map', `${portal}/front/region/location.do`],
    ['item_useful_guide_site_regional_links', 'https://wasteguide.or.kr/front/support/bannerCollection.do'],
  ]],
  ['REPRESENTATIVE_CATEGORY', 'representative', [
    ['item_useful_guide_site_disposal_methods', `${portal}/front/dischargeMethod/typeItem.do?searchCnd=11`],
    ['item_useful_guide_site_disposal_guidelines', `${portal}/front/bbsList.do?bbsId=BBS_0003`],
  ]],
  ['ITEM_DICTIONARY', 'dictionary', [
    ['item_useful_guide_site_dictionary', `${portal}/front/dischargeMethod/dictionary.do`],
    ['item_useful_guide_site_faq', `${portal}/front/bbsList.do?bbsId=BBS_0002`],
  ]],
];

export const usefulGuides = definitions.map(([type, prefix, sites]) => {
  const value = (suffix: string) => itemText(strings[`item_useful_guide_${prefix}_${suffix}` as keyof typeof strings]);
  return {
    type, icon: guideIcons[type], label: value('label'), title: value('title'), description: value('description'), cta: value('cta'),
    detailTitle: type === 'SMALL_E_WASTE' ? value('method_title') : strings.item_useful_guide_detail_section_title,
    details: type === 'SMALL_E_WASTE' ? ['bin', 'location', 'pickup'].map(key => value(`method_line_${key}`)) : [value('detail')],
    cautions: type === 'SMALL_E_WASTE' ? ['large', 'battery', 'place'].map(key => value(`caution_line_${key}`)) : [value('caution')],
    sites: sites.map(([key, url]) => ({ label: itemText(strings[key]), url })),
  };
});
