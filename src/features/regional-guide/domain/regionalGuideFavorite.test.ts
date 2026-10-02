import type { RegionSelection } from './Region';
import {
  createRegionalGuideFavorite,
  createRegionalGuideFavoriteTargetId,
  findFavoriteGuide,
  isRegionalGuideFavorite,
} from './regionalGuideFavorite';
import type { RegionalDisposalGuide } from './RegionalDisposalGuide';

const selection: RegionSelection = {
  sido: { id: 'sido:11', level: 'sido', name: '서울특별시' },
  sigungu: {
    id: 'sigungu:11680',
    level: 'sigungu',
    name: '강남구',
    parentId: 'sido:11',
  },
  eupmyeondong: {
    id: 'eupmyeondong:1168064000',
    level: 'eupmyeondong',
    name: '역삼1동',
    parentId: 'sigungu:11680',
  },
};

describe('지역 가이드 Favorite 식별자', () => {
  it('표시 이름이 같아도 관리구역과 안내 대상이 다르면 구분합니다', () => {
    const first = guide({ managementZoneName: '1권역' });
    const second = guide({ managementZoneName: '2권역' });

    expect(createRegionalGuideFavoriteTargetId(selection, first)).not.toBe(
      createRegionalGuideFavoriteTargetId(selection, second),
    );
  });

  it('공백 표기 차이는 정규화하고 필드 경계 충돌은 방지합니다', () => {
    expect(
      createRegionalGuideFavoriteTargetId(
        selection,
        guide({ managementZoneName: '  1권역  ' }),
      ),
    ).toBe(
      createRegionalGuideFavoriteTargetId(
        selection,
        guide({ managementZoneName: '1권역' }),
      ),
    );
    expect(
      createRegionalGuideFavoriteTargetId(
        selection,
        guide({ targetRegionName: 'ab', managementZoneName: 'c' }),
      ),
    ).not.toBe(
      createRegionalGuideFavoriteTargetId(
        selection,
        guide({ targetRegionName: 'a', managementZoneName: 'bc' }),
      ),
    );
  });

  it('최신 응답에서 저장 당시와 같은 실제 안내 대상을 찾습니다', () => {
    const storedGuide = guide({
      managementZoneName: '2권역',
      sourceMetadata: { managementNumber: 'guide-1' },
    });
    const favorite = createRegionalGuideFavorite(
      selection,
      storedGuide,
      '2026-09-24T00:00:00.000Z',
    );
    const latestGuide = {
      ...storedGuide,
      disposalPlace: '최신 배출장소',
      disposalPlaceType: '거점수거',
      sourceMetadata: { managementNumber: 'guide-2' },
    };
    const latest = [
      guide({ managementZoneName: '1권역' }),
      latestGuide,
    ];

    expect(findFavoriteGuide(favorite, latest)?.disposalPlace).toBe(
      '최신 배출장소',
    );
    expect(
      createRegionalGuideFavoriteTargetId(selection, latestGuide),
    ).toBe(favorite.targetId);
    expect(isRegionalGuideFavorite(favorite)).toBe(true);
  });

  it('저장된 식별자가 보존 정보와 다르면 잘못된 항목으로 거부합니다', () => {
    const favorite = createRegionalGuideFavorite(selection, guide());

    expect(
      isRegionalGuideFavorite({ ...favorite, targetId: `${favorite.targetId}broken` }),
    ).toBe(false);
  });
});

function guide(
  overrides: Partial<RegionalDisposalGuide> = {},
): RegionalDisposalGuide {
  return {
    sidoName: '서울특별시',
    sigunguName: '강남구',
    targetRegionName: '역삼1동',
    managementZoneName: '1권역',
    disposalPlaceType: '문전수거',
    schedules: [],
    ...overrides,
  };
}
