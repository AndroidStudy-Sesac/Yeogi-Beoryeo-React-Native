import { useIsFocused } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback } from 'react';

import { ItemGuideDetailScreen } from '../../features/item-search/presentation/ItemGuideDetailScreen';
import { ItemSearchScreen } from '../../features/item-search/presentation/ItemSearchScreen';
import type { ItemSearchSnapshot } from '../../features/item-search/presentation/useItemSearch';
import { APP_SCREEN_ROUTES, type HomeStackParamList } from './routes';

const Stack = createNativeStackNavigator<HomeStackParamList>();

function ItemSearchRoute({ navigation, route }: NativeStackScreenProps<HomeStackParamList, 'ItemSearch'>) {
  const focused = useIsFocused();
  const rememberSearch = useCallback((savedSearchState: ItemSearchSnapshot) => {
    navigation.setParams({ savedSearchState });
  }, [navigation]);

  return <ItemSearchScreen initialQuery={route.params?.initialQuery}
    savedState={route.params?.savedSearchState} onSnapshot={rememberSearch} focused={focused}
    onGuideSelected={guideId => navigation.navigate(APP_SCREEN_ROUTES.ITEM_GUIDE_DETAIL, { guideId, source: 'SEARCH' })} />;
}

function ItemGuideDetailRoute({ navigation, route }: NativeStackScreenProps<HomeStackParamList, 'ItemGuideDetail'>) {
  const rememberScroll = useCallback((scrollOffset: number) => navigation.setParams({ scrollOffset }), [navigation]);
  return <ItemGuideDetailScreen guideId={route.params.guideId} onBack={() => navigation.goBack()}
    savedScrollOffset={route.params.scrollOffset} onScrollOffsetChange={rememberScroll} />;
}

export function RootNavigator() {
  return <Stack.Navigator initialRouteName={APP_SCREEN_ROUTES.ITEM_SEARCH} screenOptions={{ headerShown: false }}>
    <Stack.Screen component={ItemSearchRoute} name={APP_SCREEN_ROUTES.ITEM_SEARCH} />
    <Stack.Screen component={ItemGuideDetailRoute} name={APP_SCREEN_ROUTES.ITEM_GUIDE_DETAIL} />
  </Stack.Navigator>;
}
