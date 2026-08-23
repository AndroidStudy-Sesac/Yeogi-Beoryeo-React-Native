import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getBundledItemGuides, searchBundledCatalog } from './src/catalog-data';
import { FavoriteStore } from './src/favorite-store';
import { resolveRepresentativeItemId } from './src/item-home';
import { ItemSearchViewModel } from './src/item-search-view-model';
import { FavoritesScreen } from './src/screens/FavoritesScreen';
import { ItemDetailScreen } from './src/screens/ItemDetailScreen';
import { ItemSearchScreen } from './src/screens/ItemSearchScreen';
import { UsefulGuideScreen } from './src/screens/UsefulGuideScreen';
import type { UsefulGuideId } from './src/useful-guides';

export type RootStackParamList = {
  ItemSearch: undefined;
  ItemDetail: { itemId: string };
  Favorites: undefined;
  UsefulGuide: { guideId: UsefulGuideId };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function ItemSearchRoute({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'ItemSearch'>) {
  const viewModel = useMemo(
    () => new ItemSearchViewModel(searchBundledCatalog),
    [],
  );
  const state = useSyncExternalStore(
    viewModel.subscribe,
    viewModel.getSnapshot,
    viewModel.getSnapshot,
  );
  useEffect(
    () =>
      viewModel.subscribeToEvents((event) => {
        if (event.type === 'openDetail') {
          navigation.navigate('ItemDetail', { itemId: event.itemId });
        }
      }),
    [navigation, viewModel],
  );

  useEffect(() => () => viewModel.dispose(), [viewModel]);

  return (
    <ItemSearchScreen
      onOpenCategory={(category) => {
        const itemId = resolveRepresentativeItemId(
          category,
          getBundledItemGuides(),
        );
        if (itemId !== undefined) viewModel.openDetail(itemId);
      }}
      onOpenFavorites={() => navigation.navigate('Favorites')}
      onOpenGuide={(guideId) => navigation.navigate('UsefulGuide', { guideId })}
      state={state}
      viewModel={viewModel}
    />
  );
}

export default function App() {
  const favoriteStore = useMemo(() => new FavoriteStore(AsyncStorage), []);
  useEffect(() => {
    void favoriteStore.initialize();
  }, [favoriteStore]);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="ItemSearch" component={ItemSearchRoute} />
          <Stack.Screen name="ItemDetail">
            {(props) => (
              <ItemDetailScreen {...props} favoriteStore={favoriteStore} />
            )}
          </Stack.Screen>
          <Stack.Screen name="Favorites">
            {(props) => (
              <FavoritesScreen {...props} favoriteStore={favoriteStore} />
            )}
          </Stack.Screen>
          <Stack.Screen name="UsefulGuide" component={UsefulGuideScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
