import {
  createItemGuideDetailNavigationTarget,
  createMapNavigationTarget,
  createRegionalGuideNavigationTarget,
} from './navigationTargets';

describe('기능 사이 Navigation target', () => {
  it('검색 품목 상세를 홈 탭 stack에 연결합니다', () => {
    expect(createItemGuideDetailNavigationTarget('glass')).toEqual({
      name: 'HomeTab',
      params: {
        params: { guideId: 'glass', source: 'SEARCH' },
        screen: 'ItemGuideDetail',
      },
    });
  });

  it('저장 품목 상세를 저장 탭 stack에 연결합니다', () => {
    expect(
      createItemGuideDetailNavigationTarget('glass', 'FAVORITES'),
    ).toEqual({
      name: 'FavoritesTab',
      params: {
        params: { guideId: 'glass', source: 'FAVORITES' },
        screen: 'ItemGuideDetail',
      },
    });
  });

  it('지도 주소로 연 지역 가이드를 지도 탭 stack에 연결합니다', () => {
    expect(
      createRegionalGuideNavigationTarget({
        initialAddress: '서울특별시 중구',
      }),
    ).toEqual({
      name: 'MapTab',
      params: {
        params: { initialAddress: '서울특별시 중구' },
        screen: 'RegionalGuide',
      },
    });
  });

  it('저장에서 연 지역 가이드를 저장 탭 stack에 연결합니다', () => {
    expect(
      createRegionalGuideNavigationTarget({
        entrySource: 'FAVORITES',
        initialFavoriteTargetId: 'regional-guide-v2|4:Sido',
      }),
    ).toEqual({
      name: 'FavoritesTab',
      params: {
        params: {
          entrySource: 'FAVORITES',
          initialFavoriteTargetId: 'regional-guide-v2|4:Sido',
        },
        screen: 'RegionalGuide',
      },
    });
  });

  it('일반 지역 가이드를 안내 탭 stack에 연결합니다', () => {
    expect(createRegionalGuideNavigationTarget()).toEqual({
      name: 'RegionalGuideTab',
      params: { params: {}, screen: 'RegionalGuide' },
    });
  });

  it('지도 이동값을 지도 탭 root에 연결합니다', () => {
    expect(createMapNavigationTarget({ initialSpotType: 'BATTERY_BIN' })).toEqual(
      {
        name: 'MapTab',
        params: {
          params: { initialSpotType: 'BATTERY_BIN' },
          screen: 'Map',
        },
      },
    );
  });
});
