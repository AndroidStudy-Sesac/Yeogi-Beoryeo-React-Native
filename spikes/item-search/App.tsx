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
import { HomeCategoryStore } from './src/home-category-store';
import {
  homeQuickCategories,
  resolveRepresentativeItemId,
} from './src/item-home';
import { ItemSearchViewModel } from './src/item-search-view-model';
import { FavoritesScreen } from './src/screens/FavoritesScreen';
import { HomeCategorySettingsScreen } from './src/screens/HomeCategorySettingsScreen';
import { ItemDetailScreen } from './src/screens/ItemDetailScreen';
import { ItemSearchScreen } from './src/screens/ItemSearchScreen';
import { UsefulGuideScreen } from './src/screens/UsefulGuideScreen';
import type { UsefulGuideId } from './src/useful-guides';

export type RootStackParamList = {
  ItemSearch: undefined;
  ItemDetail: { itemId: string };
  Favorites: undefined;
  HomeCategorySettings: undefined;
  UsefulGuide: { guideId: UsefulGuideId };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type ItemSearchRouteProps = NativeStackScreenProps<
  RootStackParamList,
  'ItemSearch'
> &
  Readonly<{ homeCategoryStore: HomeCategoryStore }>;

function ItemSearchRoute({
  homeCategoryStore,
  navigation,
}: ItemSearchRouteProps) {
  const viewModel = useMemo(
    () => new ItemSearchViewModel(searchBundledCatalog),
    [],
  );
  const state = useSyncExternalStore(
    viewModel.subscribe,
    viewModel.getSnapshot,
    viewModel.getSnapshot,
  );
  const homeCategoryState = useSyncExternalStore(
    homeCategoryStore.subscribe,
    homeCategoryStore.getSnapshot,
    homeCategoryStore.getSnapshot,
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
      homeCategoryIds={homeCategoryState.selectedIds}
      onLimitHomeCategories={homeCategoryStore.limit}
      onOpenCategory={(category) => {
        const itemId = resolveRepresentativeItemId(
          category,
          getBundledItemGuides(),
        );
        if (itemId !== undefined) viewModel.openDetail(itemId);
      }}
      onOpenFavorites={() => navigation.navigate('Favorites')}
      onOpenHomeCategorySettings={() =>
        navigation.navigate('HomeCategorySettings')
      }
      onOpenGuide={(guideId) => navigation.navigate('UsefulGuide', { guideId })}
      state={state}
      viewModel={viewModel}
    />
  );
}

export default function App() {
  const favoriteStore = useMemo(() => new FavoriteStore(AsyncStorage), []);
  const homeCategoryStore = useMemo(
    () =>
      new HomeCategoryStore(
        AsyncStorage,
        homeQuickCategories.map(({ id }) => id),
      ),
    [],
  );
  useEffect(() => {
    void favoriteStore.initialize();
    void homeCategoryStore.initialize();
  }, [favoriteStore, homeCategoryStore]);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="ItemSearch">
            {(props) => (
              <ItemSearchRoute
                {...props}
                homeCategoryStore={homeCategoryStore}
              />
            )}
          </Stack.Screen>
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
          <Stack.Screen name="HomeCategorySettings">
            {(props) => (
              <HomeCategorySettingsScreen
                {...props}
                homeCategoryStore={homeCategoryStore}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="UsefulGuide" component={UsefulGuideScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
