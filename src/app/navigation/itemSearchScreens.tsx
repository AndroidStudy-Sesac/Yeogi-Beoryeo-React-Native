import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';

import { ItemGuideDetailScreen } from '../../features/item-search/presentation/ItemGuideDetailScreen';
import { ItemSearchScreen } from '../../features/item-search/presentation/ItemSearchScreen';
import type { ItemSearchSnapshot } from '../../features/item-search/presentation/useItemSearch';
import type { AppScreenRegistry } from './AppNavigationContext';
import { APP_SCREEN_ROUTES, type HomeStackParamList } from './routes';

function ItemSearchRoute() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList, 'ItemSearch'>>();
  const route = useRoute<RouteProp<HomeStackParamList, 'ItemSearch'>>();
  const focused = useIsFocused();
  const rememberSearch = useCallback((savedSearchState: ItemSearchSnapshot) => {
    navigation.setParams({ savedSearchState });
  }, [navigation]);

  return <ItemSearchScreen initialQuery={route.params?.initialQuery}
    savedState={route.params?.savedSearchState} onSnapshot={rememberSearch} focused={focused}
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
