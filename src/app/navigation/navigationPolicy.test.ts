import {
  BOTTOM_TAB_ITEMS,
  canControlBottomBarVisibility,
  getBottomTabNavigationAction,
  getRegionalGuideBottomTab,
  getSelectedBottomTab,
  isFavoriteRegionalGuideReentry,
  isMapRegionalGuideReentry,
  isScrollAnimatedBottomBarRoute,
  toRegionalGuideAddressParams,
} from './navigationPolicy';
import { APP_SCREEN_ROUTES, BOTTOM_TAB_ROUTES } from './routes';

describe('하단 탭 계약', () => {
  it('원본 앱과 같은 순서와 이름을 사용합니다', () => {
    expect(BOTTOM_TAB_ITEMS).toEqual([
      { label: '홈', name: 'HomeTab' },
      { label: '지도', name: 'MapTab' },
      { label: '안내', name: 'RegionalGuideTab' },
      { label: '저장', name: 'FavoritesTab' },
    ]);
  });

  it('같은 탭을 다시 선택하면 루트로 돌아갑니다', () => {
    expect(
      getBottomTabNavigationAction(
        BOTTOM_TAB_ROUTES.MAP,
        BOTTOM_TAB_ROUTES.MAP,
      ),
    ).toBe('RESET_TO_ROOT');
  });

  it('다른 탭을 선택하면 저장된 상태를 복원합니다', () => {
    expect(
      getBottomTabNavigationAction(
        BOTTOM_TAB_ROUTES.MAP,
        BOTTOM_TAB_ROUTES.FAVORITES,
      ),
    ).toBe('RESTORE_STATE');
  });
});

describe('화면별 선택 탭', () => {
  it('검색에서 연 품목 상세는 홈 탭에 속합니다', () => {
    expect(
      getSelectedBottomTab({
        name: APP_SCREEN_ROUTES.ITEM_GUIDE_DETAIL,
        params: { guideId: 'glass', source: 'SEARCH' },
      }),
    ).toBe(BOTTOM_TAB_ROUTES.HOME);
  });

  it('저장에서 연 품목 상세는 저장 탭에 속합니다', () => {
    expect(
      getSelectedBottomTab({
        name: APP_SCREEN_ROUTES.ITEM_GUIDE_DETAIL,
        params: { guideId: 'glass', source: 'FAVORITES' },
      }),
    ).toBe(BOTTOM_TAB_ROUTES.FAVORITES);
  });

  it('유용한 가이드는 선택 탭을 표시하지 않습니다', () => {
    expect(
      getSelectedBottomTab({ name: APP_SCREEN_ROUTES.ITEM_USEFUL_GUIDE }),
    ).toBeUndefined();
  });
});

describe('지역 가이드 진입 출처', () => {
  it('검색 조건이 없으면 안내 탭에 속합니다', () => {
    expect(getRegionalGuideBottomTab()).toBe(
      BOTTOM_TAB_ROUTES.REGIONAL_GUIDE,
    );
  });

  it('지도 주소로 열면 지도 탭에 속합니다', () => {
    const params = { initialAddress: '서울특별시 중구 퇴계로 63' };

    expect(isMapRegionalGuideReentry(params)).toBe(true);
    expect(getRegionalGuideBottomTab(params)).toBe(BOTTOM_TAB_ROUTES.MAP);
  });

  it('저장된 대상을 저장 탭에서 열면 저장 탭에 속합니다', () => {
    const params = {
      entrySource: 'FAVORITES' as const,
      initialFavoriteTargetId: 'regional-guide-v2|4:Sido',
    };

    expect(isFavoriteRegionalGuideReentry(params)).toBe(true);
    expect(getRegionalGuideBottomTab(params)).toBe(
      BOTTOM_TAB_ROUTES.FAVORITES,
    );
  });

  it('주소와 대상이 함께 있으면 출처가 없는 한 안내 탭에 속합니다', () => {
    const params = {
      initialAddress: '서울특별시 중구 퇴계로 63',
      initialFavoriteTargetId: 'regional-guide-v2|4:Sido',
    };

    expect(isFavoriteRegionalGuideReentry(params)).toBe(false);
    expect(isMapRegionalGuideReentry(params)).toBe(false);
    expect(getRegionalGuideBottomTab(params)).toBe(
      BOTTOM_TAB_ROUTES.REGIONAL_GUIDE,
    );
  });

  it('장소 주소의 양쪽 공백을 제거하고 빈 주소는 거부합니다', () => {
    expect(toRegionalGuideAddressParams('  서울특별시 중구  ')).toEqual({
      initialAddress: '서울특별시 중구',
    });
    expect(toRegionalGuideAddressParams('   ')).toBeUndefined();
  });
});

describe('하단 탭 표시 정책', () => {
  it('상세와 보조 화면은 스크롤에 따라 탭을 숨길 수 있습니다', () => {
    expect(
      isScrollAnimatedBottomBarRoute(APP_SCREEN_ROUTES.ITEM_GUIDE_DETAIL),
    ).toBe(true);
    expect(
      isScrollAnimatedBottomBarRoute(APP_SCREEN_ROUTES.SETTINGS_DETAIL),
    ).toBe(true);
  });

  it('품목 검색은 스크롤 정책이 활성화된 경우에만 탭을 숨깁니다', () => {
    expect(
      isScrollAnimatedBottomBarRoute(APP_SCREEN_ROUTES.ITEM_SEARCH),
    ).toBe(false);
    expect(
      isScrollAnimatedBottomBarRoute(APP_SCREEN_ROUTES.ITEM_SEARCH, true),
    ).toBe(true);
  });

  it('지도는 스크롤 애니메이션 없이 탭 표시 상태를 제어합니다', () => {
    expect(canControlBottomBarVisibility(APP_SCREEN_ROUTES.MAP)).toBe(true);
    expect(isScrollAnimatedBottomBarRoute(APP_SCREEN_ROUTES.MAP)).toBe(false);
  });
});
