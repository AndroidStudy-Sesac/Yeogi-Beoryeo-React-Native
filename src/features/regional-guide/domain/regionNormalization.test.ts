import {
  createComparableRegionNames,
  createNumberOmittedDongName,
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

  it('공백과 중점만 정규화하고 지명에 포함된 제를 보존합니다', () => {
    expect(normalizeRegionName(' 종로  제1·2동 ')).toBe('종로제1.2동');
    expect(normalizeRegionName('홍제1동')).toBe('홍제1동');
  });

  it('출시 앱과 같은 행정동 비교 이름을 생성합니다', () => {
    expect(createComparableRegionNames('홍제제1동')).toEqual([
      '홍제제1동',
      '홍제1동',
    ]);
    expect(createComparableRegionNames('금호2·3가동')).toEqual([
      '금호2.3가동',
      '금호2가동',
      '금호3가동',
    ]);
    expect(createComparableRegionNames('불로.봉무동')).toEqual([
      '불로.봉무동',
      '불로봉무동',
    ]);
  });

  it('번호 생략 별칭에서 홍제와 거제의 지명 글자를 보존합니다', () => {
    expect(createNumberOmittedDongName('홍제제1동')).toBe('홍제동');
    expect(createNumberOmittedDongName('거제제1동')).toBe('거제동');
  });

  it('광주는 시도 별칭으로, 광주시는 시군구 이름으로 구분합니다', () => {
    expect(isSidoName('광주')).toBe(true);
    expect(isSidoName('광주시')).toBe(false);
  });
});
