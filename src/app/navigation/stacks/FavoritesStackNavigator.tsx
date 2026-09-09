import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAppScreens } from '../AppNavigationContext';
import { APP_SCREEN_ROUTES, type FavoritesStackParamList } from '../routes';

const FavoritesStack = createNativeStackNavigator<FavoritesStackParamList>();

export function FavoritesStackNavigator() {
  const screens = useAppScreens();

  return (
    <FavoritesStack.Navigator
      initialRouteName={APP_SCREEN_ROUTES.FAVORITES}
      screenOptions={{ headerShown: false }}
    >
      <FavoritesStack.Screen
        component={screens.Favorites}
        name={APP_SCREEN_ROUTES.FAVORITES}
      />
      <FavoritesStack.Screen
        component={screens.ItemGuideDetail}
        name={APP_SCREEN_ROUTES.ITEM_GUIDE_DETAIL}
      />
      <FavoritesStack.Screen
        component={screens.Map}
        name={APP_SCREEN_ROUTES.MAP}
      />
      <FavoritesStack.Screen
        component={screens.RegionalGuide}
        name={APP_SCREEN_ROUTES.REGIONAL_GUIDE}
      />
    </FavoritesStack.Navigator>
  );
}
