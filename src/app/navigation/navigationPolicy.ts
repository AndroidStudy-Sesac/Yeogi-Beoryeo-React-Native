import {
  APP_SCREEN_ROUTES,
  BOTTOM_TAB_ROUTES,
  type AppScreenRouteName,
  type BottomTabRouteName,
  type ItemGuideDetailRouteParams,
  type RegionalGuideRouteParams,
} from './routes';

export const BOTTOM_TAB_ITEMS = [
  { label: '홈', name: BOTTOM_TAB_ROUTES.HOME },
  { label: '지도', name: BOTTOM_TAB_ROUTES.MAP },
  { label: '안내', name: BOTTOM_TAB_ROUTES.REGIONAL_GUIDE },
  { label: '저장', name: BOTTOM_TAB_ROUTES.FAVORITES },
] as const;

export type BottomTabNavigationAction = 'RESET_TO_ROOT' | 'RESTORE_STATE';
export type RegionalGuideBottomTabRouteName = Exclude<
  BottomTabRouteName,
  'HomeTab'
>;

export type AppRouteSelection =
  | {
      name:
        | 'ItemSearch'
        | 'QuickCategorySettings'
        | 'Settings'
        | 'SettingsDetail'
        | 'ItemUsefulGuide'
        | 'Map'
        | 'Favorites';
    }
  | { name: 'ItemGuideDetail'; params: ItemGuideDetailRouteParams }
  | { name: 'RegionalGuide'; params?: RegionalGuideRouteParams };

export function getBottomTabNavigationAction(
  currentTab: BottomTabRouteName | undefined,
  targetTab: BottomTabRouteName,
): BottomTabNavigationAction {
  return currentTab === targetTab ? 'RESET_TO_ROOT' : 'RESTORE_STATE';
}

export function isFavoriteRegionalGuideReentry(
  params: RegionalGuideRouteParams = {},
): boolean {
  return (
    hasText(params.initialFavoriteTargetId) &&
    params.entrySource === 'FAVORITES'
  );
}

export function isMapRegionalGuideReentry(
  params: RegionalGuideRouteParams = {},
): boolean {
  return !hasText(params.initialFavoriteTargetId) && hasText(params.initialAddress);
}

export function getRegionalGuideBottomTab(
  params: RegionalGuideRouteParams = {},
): RegionalGuideBottomTabRouteName {
  if (isFavoriteRegionalGuideReentry(params)) {
    return BOTTOM_TAB_ROUTES.FAVORITES;
  }

  if (isMapRegionalGuideReentry(params)) {
    return BOTTOM_TAB_ROUTES.MAP;
  }

  return BOTTOM_TAB_ROUTES.REGIONAL_GUIDE;
}

export function toRegionalGuideAddressParams(
  address: string,
): RegionalGuideRouteParams | undefined {
  const initialAddress = address.trim();

  return initialAddress.length > 0 ? { initialAddress } : undefined;
}

export function getSelectedBottomTab(
  route: AppRouteSelection,
): BottomTabRouteName | undefined {
  switch (route.name) {
    case APP_SCREEN_ROUTES.ITEM_SEARCH:
    case APP_SCREEN_ROUTES.QUICK_CATEGORY_SETTINGS:
    case APP_SCREEN_ROUTES.SETTINGS:
    case APP_SCREEN_ROUTES.SETTINGS_DETAIL:
      return BOTTOM_TAB_ROUTES.HOME;
    case APP_SCREEN_ROUTES.ITEM_GUIDE_DETAIL:
      return route.params.source === 'FAVORITES'
        ? BOTTOM_TAB_ROUTES.FAVORITES
        : BOTTOM_TAB_ROUTES.HOME;
    case APP_SCREEN_ROUTES.MAP:
      return BOTTOM_TAB_ROUTES.MAP;
    case APP_SCREEN_ROUTES.REGIONAL_GUIDE:
      return getRegionalGuideBottomTab(route.params);
    case APP_SCREEN_ROUTES.FAVORITES:
      return BOTTOM_TAB_ROUTES.FAVORITES;
    case APP_SCREEN_ROUTES.ITEM_USEFUL_GUIDE:
      return undefined;
  }
}

export function canControlBottomBarVisibility(
  routeName: AppScreenRouteName,
  itemSearchScrollEnabled = false,
): boolean {
  return (
    routeName === APP_SCREEN_ROUTES.MAP ||
    isScrollAnimatedBottomBarRoute(routeName, itemSearchScrollEnabled)
  );
}

export function isScrollAnimatedBottomBarRoute(
  routeName: AppScreenRouteName,
  itemSearchScrollEnabled = false,
): boolean {
  return (
    (routeName === APP_SCREEN_ROUTES.ITEM_SEARCH && itemSearchScrollEnabled) ||
    routeName === APP_SCREEN_ROUTES.ITEM_GUIDE_DETAIL ||
    routeName === APP_SCREEN_ROUTES.ITEM_USEFUL_GUIDE ||
    routeName === APP_SCREEN_ROUTES.SETTINGS_DETAIL
  );
}

function hasText(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}
