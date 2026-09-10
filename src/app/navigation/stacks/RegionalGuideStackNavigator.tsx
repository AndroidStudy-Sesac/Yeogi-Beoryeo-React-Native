import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAppScreens } from '../AppNavigationContext';
import { APP_SCREEN_ROUTES, type RegionalGuideStackParamList } from '../routes';

const RegionalGuideStack =
  createNativeStackNavigator<RegionalGuideStackParamList>();

export function RegionalGuideStackNavigator() {
  const screens = useAppScreens();

  return (
    <RegionalGuideStack.Navigator
      initialRouteName={APP_SCREEN_ROUTES.REGIONAL_GUIDE}
      screenOptions={{ headerShown: false }}
    >
      <RegionalGuideStack.Screen
        component={screens.RegionalGuide}
        name={APP_SCREEN_ROUTES.REGIONAL_GUIDE}
      />
    </RegionalGuideStack.Navigator>
  );
}
