import type { RegionSelection } from './Region';
import { createRegionalGuideQuery } from './regionalGuideQuery';

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
      sidoName: '서울특별시',
      sigunguName: '강남구',
      eupmyeondongName: '역삼1동',
    });
    expect(createRegionalGuideQuery({ sido: selection.sido })).toBeUndefined();
  });

  it('지역 선택 계층에서 만든 세종 내부 조회 key를 표시 이름과 분리해 유지합니다', () => {
    expect(
      createRegionalGuideQuery({
        sido: { id: 'sido:36', level: 'sido', name: '세종특별자치시' },
        sigungu: {
          id: 'sigungu:36110',
          level: 'sigungu',
          name: '없음',
          parentId: 'sido:36',
        },
      }),
    ).toEqual({ sidoName: '세종특별자치시', sigunguName: '없음' });
  });

  it('법정동 별칭은 선택 행정동과 중복을 제거해 조회 조건에 보존합니다', () => {
    expect(
      createRegionalGuideQuery(
        {
          sido: { id: '11', level: 'sido', name: '서울특별시' },
          sigungu: { id: '11680', level: 'sigungu', name: '강남구' },
          eupmyeondong: {
            id: '1168064000',
            level: 'eupmyeondong',
            name: '역삼1동',
          },
        },
        ['역삼동', ' 역삼동 ', '역삼1동'],
      ),
    ).toEqual({
      sidoName: '서울특별시',
      sigunguName: '강남구',
      eupmyeondongName: '역삼1동',
      eupmyeondongAliases: ['역삼동'],
    });
  });
});
