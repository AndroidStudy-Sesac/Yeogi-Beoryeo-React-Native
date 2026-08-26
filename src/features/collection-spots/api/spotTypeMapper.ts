import type { CollectionSpotType } from '../model/CollectionSpot';

const medicineKeywords = [
  '폐의약품 수거함',
  '폐의약품수거함',
  '의약품 수거함',
  '의약품수거함',
  '약국 폐의약품 수거함',
  '약국 폐의약품수거함',
];

const fluorescentLampKeywords = [
  '폐형광등 수거함',
  '폐형광등수거함',
  '형광등 수거함',
  '형광등수거함',
];

const clothingKeywords = ['의류 수거함', '의류수거함'];

const icePackKeywords = ['아이스팩 수거함'];

const wasteCookingOilKeywords = [
  '폐식용유 수거함',
  '폐식용유수거함',
  '폐식용유 배출함',
  '식물성 식용유 수거함',
];

const hazardousWasteKeywords = [
  '생활계 유해폐기물 전용수거함',
  '생활계유해폐기물 전용수거함',
  '생활계유해폐기물전용수거함',
  '유해폐기물 전용수거함',
  '유해폐기물수거함',
];

const batteryKeywords = [
  '폐건전지 수거함',
  '건전지 수거함',
  '전지 수거함',
  '폐전지 수거함',
  '전지수거함',
  '건전지',
  '폐전지',
];

const phoneKeywords = [
  '폐휴대폰 배출처',
  '폐휴대폰',
  '휴대폰 수거함',
  '휴대폰 배출함',
];

const recyclingCenterKeywords = [
  '재활용센터',
  '재활용 센터',
  '재활용정거장',
  '재활용동네마당',
  '재활용 동네마당',
  '재활용도움센터',
  '클린하우스',
  '클린 하우스',
  '재활용품 분리배출함',
  '재활용품 분리수거함',
  '재활용품 공동배출장소',
  '재활용품 분리배출장소',
];

const standardBagKeywords = ['종량제', '봉투'];

const smallEWasteKeywords = [
  '중소형 수거함',
  '중소형수거함',
  '중소형 폐가전수거함',
  '중소형폐가전수거함',
  '중소형 폐가전 수거함',
  '소형가전 수거함',
  '소형가전수거함',
  '소형전기전자제품 수거함',
  '소형전기전자제품수거함',
  '폐가전 수거함',
  '폐가전수거함',
];

const containsAny = (text: string, keywords: string[]) =>
  keywords.some((keyword) => text.includes(keyword));

export const mapCollectionSpotType = (
  spotName?: string | null,
  detailLocation?: string | null
): CollectionSpotType => {
  const targetText = [spotName, detailLocation]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .trim();

  if (containsAny(targetText, medicineKeywords)) {
    return 'MEDICINE_DROP_BOX';
  }

  if (containsAny(targetText, batteryKeywords)) {
    return 'BATTERY_BIN';
  }

  if (containsAny(targetText, fluorescentLampKeywords)) {
    return 'FLUORESCENT_LAMP_BIN';
  }

  if (containsAny(targetText, clothingKeywords)) {
    return 'CLOTHING_BIN';
  }

  if (containsAny(targetText, icePackKeywords)) {
    return 'ICE_PACK_BIN';
  }

  if (containsAny(targetText, wasteCookingOilKeywords)) {
    return 'WASTE_COOKING_OIL_BIN';
  }

  if (containsAny(targetText, hazardousWasteKeywords)) {
    return 'HAZARDOUS_WASTE_BIN';
  }

  if (containsAny(targetText, phoneKeywords)) {
    return 'PHONE_DROP_OFF';
  }

  if (containsAny(targetText, recyclingCenterKeywords)) {
    return 'RECYCLING_CENTER';
  }

  if (containsAny(targetText, standardBagKeywords)) {
    return 'STANDARD_BAG_STORE';
  }

  if (containsAny(targetText, smallEWasteKeywords)) {
    return 'SMALL_E_WASTE_BIN';
  }

  return 'OTHER';
};
