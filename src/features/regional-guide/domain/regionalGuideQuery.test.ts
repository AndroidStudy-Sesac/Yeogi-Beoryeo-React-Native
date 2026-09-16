import type { RegionSelection } from './Region';
import type { RegionalDisposalGuide } from './RegionalDisposalGuide';
import {
  createRegionalGuideQuery,
  selectGuidesForRegion,
} from './regionalGuideQuery';

describe('지역 가이드 조회 조건', () => {
  it('선택 지역에서 시군구와 선택적인 읍면동 조건을 만듭니다', () => {
    const selection: RegionSelection = {
      sido: { id: '11', level: 'sido', name: ' 서울특별시 ' },
      sigungu: { id: '11680', level: 'sigungu', name: ' 강남구 ' },
      eupmyeondong: {
        id: '1168064000',
        level: 'eupmyeondong',
        name: ' 역삼1동 ',
      },
    };

    expect(createRegionalGuideQuery(selection)).toEqual({
      sigunguName: '강남구',
      eupmyeondongName: '역삼1동',
    });
    expect(createRegionalGuideQuery({ sido: selection.sido })).toBeUndefined();
  });

  it('선택 읍면동과 전체·범위 안내를 매칭합니다', () => {
    const guides: readonly RegionalDisposalGuide[] = [
      guide('역삼1동'),
      guide('강남구 전지역'),
      guide('신사1동~3동'),
    ];

    expect(selectGuidesForRegion(guides, '역삼1동')).toEqual([
      guides[0],
      guides[1],
    ]);
    expect(selectGuidesForRegion(guides, '신사제2동')).toEqual([
      guides[1],
      guides[2],
    ]);
    expect(selectGuidesForRegion(guides)).toBe(guides);
  });
});

function guide(targetRegionName: string): RegionalDisposalGuide {
  return { targetRegionName, schedules: [] };
}
