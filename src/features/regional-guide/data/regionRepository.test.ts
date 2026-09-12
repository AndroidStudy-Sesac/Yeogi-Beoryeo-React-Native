import { createRegionCatalog, getRegionCatalog } from './regionRepository';

describe('지역 asset repository', () => {
  it('변환된 실제 지역 데이터와 제공 가능 계산 결과를 재사용합니다', () => {
    const first = getRegionCatalog();
    const second = getRegionCatalog();

    expect(second).toBe(first);
    expect(first.invalidRowCount).toBe(0);
    expect(first.findChildren('sido')).toHaveLength(16);
    expect(first.regions).toHaveLength(3_157);
  });

  it('잘못된 행은 제외하고 유효한 제공 지역으로 실행을 유지합니다', () => {
    const catalog = createRegionCatalog(
      [
        { sidoName: '서울특별시', sigunguName: '강남구' },
        { sidoName: '', sigunguName: '누락구' },
      ],
      [
        {
          sidoName: '서울특별시',
          sigunguName: '강남구',
          managementZoneName: '역삼1동',
          targetRegionName: '역삼1동',
        },
      ],
      [
        {
          adminCode: '1168064000',
          sidoName: '서울특별시',
          sigunguName: '강남구',
          eupmyeondongName: '역삼1동',
        },
        {
          adminCode: '1168065000',
          sidoName: '서울특별시',
          sigunguName: '강남구',
          eupmyeondongName: '대치동',
        },
        {
          adminCode: 'invalid',
          sidoName: '서울특별시',
          sigunguName: '강남구',
          eupmyeondongName: '',
        },
      ],
      [
        {
          legalCode: 'invalid',
          legalDongName: '역삼동',
          adminCode: '',
          sidoName: '서울특별시',
          sigunguName: '강남구',
          adminDongName: '역삼1동',
        },
      ],
    );

    expect(catalog.invalidRowCount).toBe(3);
    expect(catalog.regions.map(region => region.name)).toEqual([
      '서울특별시',
      '강남구',
      '역삼1동',
    ]);
  });

  it('세부 제공 범위가 없으면 시군구의 모든 행정동을 제공합니다', () => {
    const catalog = createRegionCatalog(
      [{ sidoName: '서울특별시', sigunguName: '강북구' }],
      [
        {
          sidoName: '서울특별시',
          sigunguName: '강북구',
          managementZoneName: '강북구전역',
          targetRegionName: '강북구전역',
        },
      ],
      [
        {
          adminCode: '1130553500',
          sidoName: '서울특별시',
          sigunguName: '강북구',
          eupmyeondongName: '번1동',
        },
        {
          adminCode: '1130554500',
          sidoName: '서울특별시',
          sigunguName: '강북구',
          eupmyeondongName: '번2동',
        },
      ],
    );
    const sido = catalog.findChildren('sido')[0];
    const sigungu = catalog.findChildren('sigungu', sido.id)[0];

    expect(
      catalog
        .findChildren('eupmyeondong', sigungu.id)
        .map(region => region.name),
    ).toEqual(['번1동', '번2동']);
  });

  it('번호 범위와 제 표기를 제공 가능한 행정동에 연결합니다', () => {
    const catalog = createRegionCatalog(
      [{ sidoName: '부산광역시', sigunguName: '사하구' }],
      [
        {
          sidoName: '부산광역시',
          sigunguName: '사하구',
          managementZoneName: '1구역',
          targetRegionName: '괴정 1~3동, 하단 1~2동',
        },
      ],
      [
        administrativeRow('1111111111', '괴정제1동'),
        administrativeRow('1111111112', '괴정제3동'),
        administrativeRow('1111111113', '괴정제4동'),
        administrativeRow('1111111114', '하단제2동'),
      ],
    );
    const sido = catalog.findChildren('sido')[0];
    const sigungu = catalog.findChildren('sigungu', sido.id)[0];

    expect(
      catalog
        .findChildren('eupmyeondong', sigungu.id)
        .map(region => region.name),
    ).toEqual(['괴정제1동', '괴정제3동', '하단제2동']);
  });

  it('법정동을 제공 행정동의 검색 별칭으로 연결합니다', () => {
    const catalog = createRegionCatalog(
      [{ sidoName: '대전광역시', sigunguName: '유성구' }],
      [
        {
          sidoName: '대전광역시',
          sigunguName: '유성구',
          managementZoneName: '구즉동',
          targetRegionName: '송강동+봉산동',
        },
      ],
      [
        {
          adminCode: '3020058000',
          sidoName: '대전광역시',
          sigunguName: '유성구',
          eupmyeondongName: '구즉동',
        },
      ],
    );
    const gujeuk = catalog.regions.find(region => region.name === '구즉동');

    expect(catalog.searchAliasesByRegionId.get(gujeuk?.id ?? '')).toEqual([
      '송강동',
      '봉산동',
    ]);
  });

  it('관리구역 표기와 무관하게 원본 법정동 매핑을 검색 별칭으로 연결합니다', () => {
    const catalog = createRegionCatalog(
      [{ sidoName: '전남광주통합특별시', sigunguName: '목포시' }],
      [
        {
          sidoName: '전남광주통합특별시',
          sigunguName: '목포시',
          managementZoneName: '1권역',
          targetRegionName: '삼향동+석현동',
        },
      ],
      [
        {
          adminCode: '1211078000',
          sidoName: '전남광주통합특별시',
          sigunguName: '목포시',
          eupmyeondongName: '삼향동',
        },
      ],
      [
        {
          legalCode: '1211016000',
          legalDongName: '석현동',
          adminCode: '1211078000',
          sidoName: '전남광주통합특별시',
          sigunguName: '목포시',
          adminDongName: '삼향동',
        },
      ],
    );
    const samhyang = catalog.regions.find(region => region.name === '삼향동');

    expect(catalog.searchAliasesByRegionId.get(samhyang?.id ?? '')).toEqual([
      '석현동',
    ]);
  });
});

function administrativeRow(adminCode: string, eupmyeondongName: string) {
  return {
    adminCode,
    sidoName: '부산광역시',
    sigunguName: '사하구',
    eupmyeondongName,
  };
}
