import { createRegionCatalog, getRegionCatalog } from './regionRepository';

describe('지역 asset repository', () => {
  it('변환된 실제 지역 데이터와 제공 가능 계산 결과를 재사용합니다', () => {
    const first = getRegionCatalog();
    const second = getRegionCatalog();

    expect(second).toBe(first);
    expect(first.invalidRowCount).toBe(0);
    expect(first.findChildren('sido')).toHaveLength(16);
    expect(first.regions).toHaveLength(3_148);
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
    );

    expect(catalog.invalidRowCount).toBe(2);
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
});
