export type UsefulGuideId =
  | 'small-e-waste'
  | 'regional-guide'
  | 'representative-category'
  | 'item-dictionary';

export type UsefulGuideSite = Readonly<{
  label: string;
  url: string;
}>;

export type UsefulGuide = Readonly<{
  caution: string;
  description: string;
  detail: string;
  id: UsefulGuideId;
  label: string;
  sites: readonly UsefulGuideSite[];
  title: string;
}>;

export const usefulGuides: readonly UsefulGuide[] = [
  {
    id: 'small-e-waste',
    label: '소형가전 수거함',
    title: '중소형 폐가전은 전용 수거함을 확인하세요.',
    description: '가까운 수거함 위치와 배출 가능한 품목을 먼저 확인할 수 있어요.',
    detail: '제품 안의 건전지와 개인정보 저장 장치는 가능한 범위에서 분리하거나 초기화한 뒤 배출하세요.',
    caution: '수거함마다 크기와 접수 품목이 다를 수 있으므로 방문 전에 운영 정보를 확인하세요.',
    sites: [
      { label: '분리배출 누리집', url: 'https://xn--oy2b29bd3a601b.kr/' },
      { label: '폐가전 수거함 찾기', url: 'https://www.re.or.kr/info/listPickupPage.do' },
    ],
  },
  {
    id: 'regional-guide',
    label: '지역별 배출 안내',
    title: '사는 곳에 맞는 배출 요일과 장소를 확인하세요.',
    description: '같은 품목도 지역에 따라 배출 시간과 장소가 달라질 수 있어요.',
    detail: '시·군·구와 동 이름을 기준으로 지자체 안내를 찾아 최종 배출 방법을 확인하세요.',
    caution: '이 앱의 품목 안내보다 관할 지자체의 최신 공지와 현장 안내를 우선하세요.',
    sites: [
      { label: '지역별 배출장소', url: 'https://xn--oy2b29bd3a601b.kr/front/region/location.do' },
      { label: '지역별 안내 링크', url: 'https://wasteguide.or.kr/front/support/bannerCollection.do' },
    ],
  },
  {
    id: 'representative-category',
    label: '품목 유형별 배출 방법',
    title: '대표 분류부터 확인하면 배출 방법을 빠르게 찾을 수 있어요.',
    description: '종이, 유리병, 전지처럼 자주 찾는 분류의 기본 배출 방법을 모아 봅니다.',
    detail: '홈의 빠른 카테고리를 선택하면 해당 분류의 대표 품목 상세로 이동합니다.',
    caution: '오염 정도나 재질 조합에 따라 일반적인 분류와 다른 방법이 필요할 수 있어요.',
    sites: [
      { label: '유형별 배출 방법', url: 'https://xn--oy2b29bd3a601b.kr/front/dischargeMethod/typeItem.do?searchCnd=11' },
      { label: '분리배출 지침', url: 'https://xn--oy2b29bd3a601b.kr/front/bbsList.do?bbsId=BBS_0003' },
    ],
  },
  {
    id: 'item-dictionary',
    label: '품목 사전',
    title: '정확한 품목 이름을 모를 때 품목 사전을 확인하세요.',
    description: '품목명과 비슷한 이름을 기준으로 올바른 배출 방법을 찾을 수 있어요.',
    detail: '재질과 사용 상태를 함께 확인하면 이름이 비슷한 품목도 더 정확하게 구분할 수 있습니다.',
    caution: '복합 재질 제품은 분리 가능한 부분을 나눠 각각의 배출 기준을 확인하세요.',
    sites: [
      { label: '품목 사전 열기', url: 'https://xn--oy2b29bd3a601b.kr/front/dischargeMethod/dictionary.do' },
      { label: '자주 묻는 질문', url: 'https://xn--oy2b29bd3a601b.kr/front/bbsList.do?bbsId=BBS_0002' },
    ],
  },
];

export function getUsefulGuide(guideId: UsefulGuideId): UsefulGuide {
  return usefulGuides.find((guide) => guide.id === guideId) ?? usefulGuides[0];
}
