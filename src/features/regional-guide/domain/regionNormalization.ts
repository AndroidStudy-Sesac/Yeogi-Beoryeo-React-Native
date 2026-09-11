const SIDO_ALIAS_ENTRIES = [
  ['서울', '서울특별시'],
  ['서울시', '서울특별시'],
  ['부산', '부산광역시'],
  ['부산시', '부산광역시'],
  ['대구', '대구광역시'],
  ['대구시', '대구광역시'],
  ['인천', '인천광역시'],
  ['인천시', '인천광역시'],
  ['광주', '광주광역시'],
  ['광주시', '광주광역시'],
  ['대전', '대전광역시'],
  ['대전시', '대전광역시'],
  ['울산', '울산광역시'],
  ['울산시', '울산광역시'],
  ['세종', '세종특별자치시'],
  ['세종시', '세종특별자치시'],
  ['경기', '경기도'],
  ['강원', '강원특별자치도'],
  ['강원도', '강원특별자치도'],
  ['충북', '충청북도'],
  ['충남', '충청남도'],
  ['전북', '전북특별자치도'],
  ['전라북도', '전북특별자치도'],
  ['전남', '전라남도'],
  ['경북', '경상북도'],
  ['경남', '경상남도'],
  ['제주', '제주특별자치도'],
  ['제주도', '제주특별자치도'],
] as const;

const SIDO_ALIASES = new Map<string, string>(SIDO_ALIAS_ENTRIES);
const OFFICIAL_SIDO_NAMES = new Set([
  ...SIDO_ALIAS_ENTRIES.map(([, canonicalName]) => canonicalName),
  '전남광주통합특별시',
]);
const GWANGJU_DISTRICTS = new Set(['동구', '서구', '남구', '북구', '광산구']);

export function normalizeSidoName(
  value: string | undefined,
  sigunguName?: string,
): string | undefined {
  const name = value?.trim();
  if (!name) return undefined;

  const normalized = SIDO_ALIASES.get(name) ?? name;
  if (normalized !== '전남광주통합특별시' || !sigunguName?.trim()) {
    return normalized;
  }

  return GWANGJU_DISTRICTS.has(sigunguName.trim())
    ? '광주광역시'
    : '전라남도';
}

export function isSidoName(value: string): boolean {
  const name = value.trim();
  return OFFICIAL_SIDO_NAMES.has(name) || SIDO_ALIASES.has(name);
}

export function normalizeRegionName(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[·ㆍ]/g, '.')
    .replace(/\s+/g, '')
    .replace(/제(?=\d)/g, '')
    .trim();
}
