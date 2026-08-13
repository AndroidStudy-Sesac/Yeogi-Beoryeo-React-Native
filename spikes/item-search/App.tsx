import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { searchBundledCatalog } from './src/catalog-data';
import { ItemSearchViewModel } from './src/item-search-view-model';
import { ItemDetailScreen } from './src/screens/ItemDetailScreen';
import { ItemSearchScreen } from './src/screens/ItemSearchScreen';

export type RootStackParamList = {
  ItemSearch: undefined;
  ItemDetail: { itemId: string };
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

  return <ItemSearchScreen state={state} viewModel={viewModel} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="ItemSearch" component={ItemSearchRoute} />
          <Stack.Screen name="ItemDetail" component={ItemDetailScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
