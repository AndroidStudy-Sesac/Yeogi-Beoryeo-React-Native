import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { itemSearchScreens } from './itemSearchScreens';
import { APP_SCREEN_ROUTES, type HomeStackParamList } from './routes';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function RootNavigator() {
  return <Stack.Navigator initialRouteName={APP_SCREEN_ROUTES.ITEM_SEARCH} screenOptions={{ headerShown: false }}>
    <Stack.Screen component={itemSearchScreens.ItemSearch} name={APP_SCREEN_ROUTES.ITEM_SEARCH} />
    <Stack.Screen component={itemSearchScreens.ItemGuideDetail} name={APP_SCREEN_ROUTES.ITEM_GUIDE_DETAIL} />
  </Stack.Navigator>;
}
