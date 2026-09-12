import {
  isSidoName,
  normalizeRegionName,
  normalizeSidoName,
} from './regionNormalization';

describe('지역명 정규화', () => {
  it.each([
    ['서울시', undefined, '서울특별시'],
    ['강원도', undefined, '강원특별자치도'],
    ['전라북도', undefined, '전북특별자치도'],
    ['제주도', undefined, '제주특별자치도'],
    ['전남광주통합특별시', '북구', '광주광역시'],
    ['전남광주통합특별시', '목포시', '전라남도'],
  ])('%s 표기를 공식 시도로 변환합니다', (input, sigungu, expected) => {
    expect(normalizeSidoName(input, sigungu)).toBe(expected);
  });

  it('행정동 ordinal과 중점 표기를 비교 가능한 이름으로 만듭니다', () => {
    expect(normalizeRegionName(' 종로  제1·2동 ')).toBe('종로1.2동');
  });

  it('광주는 시도 별칭으로, 광주시는 시군구 이름으로 구분합니다', () => {
    expect(isSidoName('광주')).toBe(true);
    expect(isSidoName('광주시')).toBe(false);
  });
});
