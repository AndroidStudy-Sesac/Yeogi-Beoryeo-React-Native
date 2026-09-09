import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAppScreens } from '../AppNavigationContext';
import { APP_SCREEN_ROUTES, type MapStackParamList } from '../routes';

const MapStack = createNativeStackNavigator<MapStackParamList>();

export function MapStackNavigator() {
  const screens = useAppScreens();

  return (
    <MapStack.Navigator
      initialRouteName={APP_SCREEN_ROUTES.MAP}
      screenOptions={{ headerShown: false }}
    >
      <MapStack.Screen component={screens.Map} name={APP_SCREEN_ROUTES.MAP} />
      <MapStack.Screen
        component={screens.RegionalGuide}
        name={APP_SCREEN_ROUTES.REGIONAL_GUIDE}
      />
    </MapStack.Navigator>
  );
}
