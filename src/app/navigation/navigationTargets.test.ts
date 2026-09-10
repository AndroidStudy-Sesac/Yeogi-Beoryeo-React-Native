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
        initial: false,
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
        initial: false,
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
        initial: false,
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
        initial: false,
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
      params: { initial: false, params: {}, screen: 'RegionalGuide' },
    });
  });

  it('홈 요약의 대상 ID는 저장 출처 없이 안내 탭에 연결합니다', () => {
    const params = { initialFavoriteTargetId: 'regional-guide-v2|4:Sido' };

    expect(createRegionalGuideNavigationTarget(params)).toEqual({
      name: 'RegionalGuideTab',
      params: { initial: false, params, screen: 'RegionalGuide' },
    });
  });

  it('검색어로 연 지역 가이드는 안내 탭에 연결합니다', () => {
    const params = { initialKeyword: '서울특별시 중구' };

    expect(createRegionalGuideNavigationTarget(params)).toEqual({
      name: 'RegionalGuideTab',
      params: { initial: false, params, screen: 'RegionalGuide' },
    });
  });

  it('대상이 없는 저장 출처는 타입으로 거부하고 복원 시 안내 탭으로 처리합니다', () => {
    // @ts-expect-error Favorites entry requires a saved target ID.
    const target = createRegionalGuideNavigationTarget({ entrySource: 'FAVORITES' });

    expect(target.name).toBe('RegionalGuideTab');
  });

  it('주소만 있는 저장 출처는 타입으로 거부하고 복원 시 지도 탭으로 처리합니다', () => {
    const params = {
      entrySource: 'FAVORITES' as const,
      initialAddress: '서울특별시 중구',
    };
    // @ts-expect-error An address cannot replace the saved target ID.
    const target = createRegionalGuideNavigationTarget(params);

    expect(target.name).toBe('MapTab');
  });

  it('공백 대상 ID는 저장 탭 진입으로 처리하지 않습니다', () => {
    expect(
      createRegionalGuideNavigationTarget({
        entrySource: 'FAVORITES',
        initialFavoriteTargetId: '   ',
      }).name,
    ).toBe('RegionalGuideTab');
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
