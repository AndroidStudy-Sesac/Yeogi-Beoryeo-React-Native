import { useIsFocused, useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';

import { ItemGuideDetailScreen } from '../../features/item-search/presentation/ItemGuideDetailScreen';
import { ItemSearchScreen } from '../../features/item-search/presentation/ItemSearchScreen';
import { HomeContent } from '../../features/item-search/presentation/HomeContent';
import { ItemFavoritesScreen } from '../../features/item-search/presentation/ItemFavoritesScreen';
import { ItemIcon, ItemStatus } from '../../features/item-search/presentation/ItemComponents';
import { ItemUsefulGuideScreen } from '../../features/item-search/presentation/ItemUsefulGuideScreen';
import { QuickCategorySettingsScreen } from '../../features/item-search/presentation/QuickCategorySettingsScreen';
import { useItemPreferences } from '../../features/item-search/presentation/ItemPreferencesContext';
import { loadItemGuide } from '../../features/item-search/data/itemCatalog';
import { itemFonts, useItemColors } from '../../features/item-search/presentation/itemTheme';
import type { ItemSearchSnapshot } from '../../features/item-search/presentation/useItemSearch';
import type { ItemHomeSnapshot } from '../../features/item-search/presentation/homeLayout';
import type { AppScreenRegistry } from './AppNavigationContext';
import { APP_SCREEN_ROUTES, BOTTOM_TAB_ROUTES, type AppTabParamList, type FavoritesStackParamList, type HomeStackParamList } from './routes';
import { createMapNavigationTarget, createRegionalGuideNavigationTarget } from './navigationTargets';

function ItemSearchRoute() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList, 'ItemSearch'>>();
  const route = useRoute<RouteProp<HomeStackParamList, 'ItemSearch'>>();
  const focused = useIsFocused();
  const preferences = useItemPreferences();
  const rememberSearch = useCallback((savedSearchState: ItemSearchSnapshot) => {
    navigation.setParams({ savedSearchState });
  }, [navigation]);
  const rememberHome = useCallback((savedHomeState: ItemHomeSnapshot) => {
    navigation.setParams({ savedHomeState });
  }, [navigation]);

  return <ItemSearchScreen initialQuery={route.params?.initialQuery}
    savedState={route.params?.savedSearchState} onSnapshot={rememberSearch} focused={focused}
    favoriteIds={new Set(preferences.data.favorites.map(item => item.id))}
    renderHome={searchField => <HomeContent searchField={searchField} focused={focused}
      savedState={route.params?.savedHomeState} onSnapshot={rememberHome}
      onGuideSelected={guideId => navigation.navigate(APP_SCREEN_ROUTES.ITEM_GUIDE_DETAIL, { guideId, source: 'SEARCH' })}
      onUsefulGuide={guideType => navigation.navigate(APP_SCREEN_ROUTES.ITEM_USEFUL_GUIDE, { guideType })}
      onCategorySettings={maxSelectedCount => navigation.navigate(APP_SCREEN_ROUTES.QUICK_CATEGORY_SETTINGS, { maxSelectedCount })} />}
    onGuideSelected={guideId => navigation.navigate(APP_SCREEN_ROUTES.ITEM_GUIDE_DETAIL, { guideId, source: 'SEARCH' })} />;
}

function ItemGuideDetailRoute() {
  // Both home and favorites stacks share the same detail route parameters.
  const navigation = useNavigation<NativeStackNavigationProp<Pick<HomeStackParamList, 'ItemGuideDetail'>>>();
  const route = useRoute<RouteProp<HomeStackParamList, 'ItemGuideDetail'>>();
  const { data, status, store, pending } = useItemPreferences();
  const colors = useItemColors();
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [message]);
  const canonicalId = loadItemGuide(route.params.guideId)?.id ?? route.params.guideId;
  const favorite = data.favorites.some(item => item.id === canonicalId);
  const disabled = status !== 'ready' || pending.includes(canonicalId);
  const rememberScroll = useCallback((scrollOffset: number) => navigation.setParams({ scrollOffset }), [navigation]);
  return <ItemGuideDetailScreen guideId={route.params.guideId} onBack={() => navigation.goBack()}
    onMap={initialSpotType => {
      const target = createMapNavigationTarget({ initialSpotType });
      navigation.getParent<NavigationProp<AppTabParamList>>()?.navigate(target.name, target.params);
    }}
    favoriteControl={<Pressable accessibilityRole="button" accessibilityLabel={favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
      accessibilityState={{ disabled, selected: favorite }} disabled={disabled}
      onPress={() => { void store.toggleFavorite(canonicalId).then(saved => {
        if (saved) setMessage(favorite ? '즐겨찾기에서 제외되었습니다' : '즐겨찾기에 추가되었습니다');
      }); }} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
      <ItemIcon name={favorite ? 'favorite_filled' : 'favorite'} color={favorite ? colors.tertiary : colors.muted} />
    </Pressable>}
    feedback={status === 'error' ? <ItemStatus title="즐겨찾기를 불러오지 못했어요" onRetry={() => { void store.load(); }} />
      : message ? <Text accessibilityLiveRegion="polite" style={{ fontFamily: itemFonts.medium,
      fontSize: 14, color: colors.onPrimaryContainer, padding: 12, backgroundColor: colors.primaryContainer }}>{message}</Text> : undefined}
    savedScrollOffset={route.params.scrollOffset} onScrollOffsetChange={rememberScroll} />;
}

function FavoritesRoute() {
  const navigation = useNavigation<NativeStackNavigationProp<FavoritesStackParamList>>();
  return <ItemFavoritesScreen onSearch={() => navigation.getParent<NavigationProp<AppTabParamList>>()?.navigate(
    BOTTOM_TAB_ROUTES.HOME, { screen: APP_SCREEN_ROUTES.ITEM_SEARCH })}
    onGuideSelected={guideId => navigation.navigate(APP_SCREEN_ROUTES.ITEM_GUIDE_DETAIL,
    { guideId, source: 'FAVORITES' })} />;
}

function QuickCategorySettingsRoute() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const route = useRoute<RouteProp<HomeStackParamList, 'QuickCategorySettings'>>();
  const focused = useIsFocused();
  return <QuickCategorySettingsScreen maximum={route.params.maxSelectedCount} focused={focused} onBack={() => navigation.goBack()} />;
}

function ItemUsefulGuideRoute() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const route = useRoute<RouteProp<HomeStackParamList, 'ItemUsefulGuide'>>();
  return <ItemUsefulGuideScreen type={route.params.guideType} onBack={() => navigation.goBack()}
    onAction={type => {
      const tabs = navigation.getParent<NavigationProp<AppTabParamList>>();
      if (type === 'SMALL_E_WASTE') {
        const target = createMapNavigationTarget({ initialSpotType: 'SMALL_E_WASTE_BIN' });
        tabs?.navigate(target.name, target.params);
      } else if (type === 'REGIONAL_GUIDE') {
        const target = createRegionalGuideNavigationTarget();
        tabs?.navigate(target.name, target.params);
      } else navigation.goBack();
    }} />;
}

export const itemSearchScreens = {
  ItemSearch: ItemSearchRoute,
  ItemGuideDetail: ItemGuideDetailRoute,
  Favorites: FavoritesRoute,
  ItemUsefulGuide: ItemUsefulGuideRoute,
  QuickCategorySettings: QuickCategorySettingsRoute,
} satisfies Pick<AppScreenRegistry, 'ItemSearch' | 'ItemGuideDetail' | 'Favorites' | 'ItemUsefulGuide' | 'QuickCategorySettings'>;
