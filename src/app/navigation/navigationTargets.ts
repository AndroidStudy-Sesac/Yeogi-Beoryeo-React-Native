import {
  APP_SCREEN_ROUTES,
  BOTTOM_TAB_ROUTES,
  type ItemGuideDetailRouteParams,
  type ItemGuideDetailSource,
  type MapRouteParams,
  type RegionalGuideRouteParams,
} from './routes';
import { getRegionalGuideBottomTab } from './navigationPolicy';

export type ItemGuideDetailNavigationTarget =
  | {
      name: 'FavoritesTab';
      params: {
        initial: false;
        params: ItemGuideDetailRouteParams;
        screen: 'ItemGuideDetail';
      };
    }
  | {
      name: 'HomeTab';
      params: {
        initial: false;
        params: ItemGuideDetailRouteParams;
        screen: 'ItemGuideDetail';
      };
    };

export type RegionalGuideNavigationTarget =
  | {
      name: 'FavoritesTab';
      params: {
        initial: false;
        params: RegionalGuideRouteParams;
        screen: 'RegionalGuide';
      };
    }
  | {
      name: 'MapTab';
      params: {
        initial: false;
        params: RegionalGuideRouteParams;
        screen: 'RegionalGuide';
      };
    }
  | {
      name: 'RegionalGuideTab';
      params: {
        initial: false;
        params: RegionalGuideRouteParams;
        screen: 'RegionalGuide';
      };
    };

export type MapNavigationTarget = {
  name: 'MapTab';
  params: {
    params: MapRouteParams;
    screen: 'Map';
  };
};

export function createItemGuideDetailNavigationTarget(
  guideId: string,
  source: ItemGuideDetailSource = 'SEARCH',
): ItemGuideDetailNavigationTarget {
  const params = { guideId, source };

  return source === 'FAVORITES'
    ? {
        name: BOTTOM_TAB_ROUTES.FAVORITES,
        params: {
          initial: false,
          params,
          screen: APP_SCREEN_ROUTES.ITEM_GUIDE_DETAIL,
        },
      }
    : {
        name: BOTTOM_TAB_ROUTES.HOME,
        params: {
          initial: false,
          params,
          screen: APP_SCREEN_ROUTES.ITEM_GUIDE_DETAIL,
        },
      };
}

export function createRegionalGuideNavigationTarget(
  params: RegionalGuideRouteParams = {},
): RegionalGuideNavigationTarget {
  return {
    name: getRegionalGuideBottomTab(params),
    params: { initial: false, params, screen: APP_SCREEN_ROUTES.REGIONAL_GUIDE },
  };
}

export function createMapNavigationTarget(
  params: MapRouteParams = {},
): MapNavigationTarget {
  return {
    name: BOTTOM_TAB_ROUTES.MAP,
    params: { params, screen: APP_SCREEN_ROUTES.MAP },
  };
}
