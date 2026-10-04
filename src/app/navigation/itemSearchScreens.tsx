import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';

import { ItemGuideDetailScreen } from '../../features/item-search/presentation/ItemGuideDetailScreen';
import { ItemSearchScreen } from '../../features/item-search/presentation/ItemSearchScreen';
import type { ItemSearchSnapshot } from '../../features/item-search/presentation/useItemSearch';
import { HomeRegionalGuideSummaryCard } from '../../features/home/presentation/HomeRegionalGuideSummaryCard';
import { useRegionalGuideFavorites } from '../../features/regional-guide/presentation/RegionalGuideFavoritesContext';
import { useHomeRegionalGuideSummary } from '../../features/regional-guide/presentation/useHomeRegionalGuideSummary';
import type { AppScreenRegistry } from './AppNavigationContext';
import {
  APP_SCREEN_ROUTES,
  BOTTOM_TAB_ROUTES,
  type AppTabParamList,
  type HomeStackParamList,
} from './routes';

function ItemSearchRoute() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList, 'ItemSearch'>>();
  const route = useRoute<RouteProp<HomeStackParamList, 'ItemSearch'>>();
  const focused = useIsFocused();
  const favorites = useRegionalGuideFavorites();
  const summary = useHomeRegionalGuideSummary(focused);
  const tabNavigation = () =>
    navigation.getParent<BottomTabNavigationProp<AppTabParamList>>();
  const rememberSearch = useCallback((savedSearchState: ItemSearchSnapshot) => {
    navigation.setParams({ savedSearchState });
  }, [navigation]);

  const openSummaryDetail = () => {
    if (summary.state.status !== 'ready') return;
    navigation.navigate(APP_SCREEN_ROUTES.REGIONAL_GUIDE_DETAIL, {
      initialFavoriteTargetId: summary.state.favorite.targetId,
      selection: summary.state.favorite.selection,
      source: 'HOME',
    });
  };

  return <ItemSearchScreen initialQuery={route.params?.initialQuery}
    savedState={route.params?.savedSearchState} onSnapshot={rememberSearch} focused={focused}
    homeSummaryCard={<HomeRegionalGuideSummaryCard
      state={summary.state}
      onOpenDetail={openSummaryDetail}
      onOpenRegionalGuide={() => tabNavigation()?.navigate(
        BOTTOM_TAB_ROUTES.REGIONAL_GUIDE,
        { screen: APP_SCREEN_ROUTES.REGIONAL_GUIDE },
      )}
      onOpenSaved={() => tabNavigation()?.navigate(
        BOTTOM_TAB_ROUTES.FAVORITES,
        {
          screen: APP_SCREEN_ROUTES.FAVORITES,
          params: { initialCategory: 'REGIONAL_GUIDE' },
        },
      )}
      onRetry={() => void summary.retry()}
      onRetryFavorites={() => void favorites.retryLoad()}
    />}
    onGuideSelected={guideId => navigation.navigate(APP_SCREEN_ROUTES.ITEM_GUIDE_DETAIL, { guideId, source: 'SEARCH' })} />;
}

function ItemGuideDetailRoute() {
  // Both home and favorites stacks share the same detail route parameters.
  const navigation = useNavigation<NativeStackNavigationProp<Pick<HomeStackParamList, 'ItemGuideDetail'>>>();
  const route = useRoute<RouteProp<HomeStackParamList, 'ItemGuideDetail'>>();
  const rememberScroll = useCallback((scrollOffset: number) => navigation.setParams({ scrollOffset }), [navigation]);
  return <ItemGuideDetailScreen guideId={route.params.guideId} onBack={() => navigation.goBack()}
    savedScrollOffset={route.params.scrollOffset} onScrollOffsetChange={rememberScroll} />;
}

export const itemSearchScreens = {
  ItemSearch: ItemSearchRoute,
  ItemGuideDetail: ItemGuideDetailRoute,
} satisfies Pick<AppScreenRegistry, 'ItemSearch' | 'ItemGuideDetail'>;
