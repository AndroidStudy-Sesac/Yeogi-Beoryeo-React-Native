import type { NavigatorScreenParams } from '@react-navigation/native';

export const BOTTOM_TAB_ROUTES = {
  FAVORITES: 'FavoritesTab',
  HOME: 'HomeTab',
  MAP: 'MapTab',
  REGIONAL_GUIDE: 'RegionalGuideTab',
} as const;

export const APP_SCREEN_ROUTES = {
  FAVORITES: 'Favorites',
  ITEM_GUIDE_DETAIL: 'ItemGuideDetail',
  ITEM_SEARCH: 'ItemSearch',
  ITEM_USEFUL_GUIDE: 'ItemUsefulGuide',
  MAP: 'Map',
  QUICK_CATEGORY_SETTINGS: 'QuickCategorySettings',
  REGIONAL_GUIDE: 'RegionalGuide',
  SETTINGS: 'Settings',
  SETTINGS_DETAIL: 'SettingsDetail',
} as const;

type ValueOf<T> = T[keyof T];

export type BottomTabRouteName = ValueOf<typeof BOTTOM_TAB_ROUTES>;
export type AppScreenRouteName = ValueOf<typeof APP_SCREEN_ROUTES>;

export type CollectionSpotRouteType =
  | 'SMALL_E_WASTE_BIN'
  | 'BATTERY_BIN'
  | 'PHONE_DROP_OFF'
  | 'RECYCLING_CENTER'
  | 'STANDARD_BAG_STORE'
  | 'MEDICINE_DROP_BOX'
  | 'FLUORESCENT_LAMP_BIN'
  | 'CLOTHING_BIN'
  | 'ICE_PACK_BIN'
  | 'WASTE_COOKING_OIL_BIN'
  | 'HAZARDOUS_WASTE_BIN'
  | 'OTHER';

export type ItemGuideDetailSource = 'SEARCH' | 'FAVORITES';
export type RegionalGuideEntrySource = 'FAVORITES';

export type SettingsDetailRouteType =
  | 'Notice'
  | 'Contact'
  | 'AppInfo'
  | 'LocationPermission'
  | 'Terms'
  | 'PrivacyPolicy'
  | 'Sources'
  | 'Cache';

export type ItemUsefulGuideRouteType =
  | 'SMALL_E_WASTE'
  | 'REGIONAL_GUIDE'
  | 'REPRESENTATIVE_CATEGORY'
  | 'ITEM_DICTIONARY';

export type MapRouteParams = {
  favoriteSpotAddress?: string;
  favoriteSpotDetailLocation?: string;
  favoriteSpotLatitude?: number;
  favoriteSpotLongitude?: number;
  favoriteSpotName?: string;
  favoriteSpotRequestId?: string;
  favoriteSpotTargetId?: string;
  favoriteSpotType?: CollectionSpotRouteType;
  initialSpotType?: CollectionSpotRouteType;
};

export type RegionalGuideRouteParams = {
  entrySource?: RegionalGuideEntrySource;
  initialAddress?: string;
  initialFavoriteTargetId?: string;
  initialKeyword?: string;
};

export type ItemSearchRouteParams = {
  initialQuery?: string;
};

export type QuickCategorySettingsRouteParams = {
  maxSelectedCount: number;
};

export type SettingsDetailRouteParams = {
  detailType: SettingsDetailRouteType;
};

export type ItemUsefulGuideRouteParams = {
  guideType: ItemUsefulGuideRouteType;
};

export type ItemGuideDetailRouteParams = {
  guideId: string;
  source?: ItemGuideDetailSource;
};

export type HomeStackParamList = {
  ItemGuideDetail: ItemGuideDetailRouteParams;
  ItemSearch: ItemSearchRouteParams | undefined;
  ItemUsefulGuide: ItemUsefulGuideRouteParams;
  QuickCategorySettings: QuickCategorySettingsRouteParams;
  Settings: undefined;
  SettingsDetail: SettingsDetailRouteParams;
};

export type MapStackParamList = {
  Map: MapRouteParams | undefined;
  RegionalGuide: RegionalGuideRouteParams | undefined;
};

export type RegionalGuideStackParamList = {
  RegionalGuide: RegionalGuideRouteParams | undefined;
};

export type FavoritesStackParamList = {
  Favorites: undefined;
  ItemGuideDetail: ItemGuideDetailRouteParams;
  Map: MapRouteParams | undefined;
  RegionalGuide: RegionalGuideRouteParams | undefined;
};

export type AppTabParamList = {
  FavoritesTab: NavigatorScreenParams<FavoritesStackParamList> | undefined;
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined;
  MapTab: NavigatorScreenParams<MapStackParamList> | undefined;
  RegionalGuideTab:
    | NavigatorScreenParams<RegionalGuideStackParamList>
    | undefined;
};

export type RootStackParamList = {
  AppTabs: NavigatorScreenParams<AppTabParamList> | undefined;
};

export type BootstrapStackParamList = {
  Bootstrap: undefined;
};
