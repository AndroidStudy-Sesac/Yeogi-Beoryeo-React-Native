import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAppScreens } from '../AppNavigationContext';
import { APP_SCREEN_ROUTES, type HomeStackParamList } from '../routes';

const HomeStack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStackNavigator() {
  const screens = useAppScreens();

  return (
    <HomeStack.Navigator
      initialRouteName={APP_SCREEN_ROUTES.ITEM_SEARCH}
      screenOptions={{ headerShown: false }}
    >
      <HomeStack.Screen
        component={screens.ItemSearch}
        name={APP_SCREEN_ROUTES.ITEM_SEARCH}
      />
      <HomeStack.Screen
        component={screens.ItemGuideDetail}
        name={APP_SCREEN_ROUTES.ITEM_GUIDE_DETAIL}
      />
      <HomeStack.Screen
        component={screens.QuickCategorySettings}
        name={APP_SCREEN_ROUTES.QUICK_CATEGORY_SETTINGS}
      />
      <HomeStack.Screen
        component={screens.Settings}
        name={APP_SCREEN_ROUTES.SETTINGS}
      />
      <HomeStack.Screen
        component={screens.SettingsDetail}
        name={APP_SCREEN_ROUTES.SETTINGS_DETAIL}
      />
      <HomeStack.Screen
        component={screens.ItemUsefulGuide}
        name={APP_SCREEN_ROUTES.ITEM_USEFUL_GUIDE}
      />
    </HomeStack.Navigator>
  );
}
