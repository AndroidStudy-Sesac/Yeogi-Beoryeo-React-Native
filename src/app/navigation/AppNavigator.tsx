import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  useCallback,
  createContext,
  useContext,
  useState,
  type ComponentType,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from 'react';

import { BottomTabIcon } from './BottomTabIcon';
import { BOTTOM_TAB_ITEMS } from './navigationPolicy';
import {
  APP_SCREEN_ROUTES,
  BOTTOM_TAB_ROUTES,
  type AppScreenRouteName,
  type AppTabParamList,
  type FavoritesStackParamList,
  type HomeStackParamList,
  type MapStackParamList,
  type RegionalGuideStackParamList,
} from './routes';

export type AppScreenRegistry = Record<AppScreenRouteName, ComponentType>;

const AppScreensContext = createContext<AppScreenRegistry | null>(null);
const BottomTabBarVisibilityContext = createContext<Dispatch<
  SetStateAction<boolean>
> | null>(null);
const Tab = createBottomTabNavigator<AppTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const MapStack = createNativeStackNavigator<MapStackParamList>();
const RegionalGuideStack =
  createNativeStackNavigator<RegionalGuideStackParamList>();
const FavoritesStack = createNativeStackNavigator<FavoritesStackParamList>();

export function AppNavigator({ screens }: { screens: AppScreenRegistry }) {
  const [isBottomTabBarVisible, setBottomTabBarVisible] = useState(true);

  return (
    <AppScreensProvider screens={screens}>
      <BottomTabBarVisibilityContext.Provider value={setBottomTabBarVisible}>
        <Tab.Navigator
          backBehavior="history"
          initialRouteName={BOTTOM_TAB_ROUTES.HOME}
          screenOptions={{
            headerShown: false,
            lazy: true,
            popToTopOnBlur: false,
            tabBarStyle: isBottomTabBarVisible ? undefined : { display: 'none' },
          }}
        >
          {BOTTOM_TAB_ITEMS.map(item => (
            <Tab.Screen
              component={TAB_COMPONENTS[item.name]}
              key={item.name}
              name={item.name}
              options={{
                tabBarAccessibilityLabel: `${item.label} 탭`,
                tabBarIcon: ({ color, size }) => (
                  <BottomTabIcon
                    color={color}
                    routeName={item.name}
                    size={size}
                  />
                ),
                tabBarLabel: item.label,
                title: item.label,
              }}
            />
          ))}
        </Tab.Navigator>
      </BottomTabBarVisibilityContext.Provider>
    </AppScreensProvider>
  );
}

export function useBottomTabBarVisibility(isVisible: boolean) {
  const setBottomTabBarVisible = useContext(BottomTabBarVisibilityContext);

  if (setBottomTabBarVisible === null) {
    throw new Error('AppNavigator 안에서만 하단 탭 표시 상태를 바꿀 수 있습니다.');
  }

  useFocusEffect(
    useCallback(() => {
      setBottomTabBarVisible(isVisible);

      return () => setBottomTabBarVisible(true);
    }, [isVisible, setBottomTabBarVisible]),
  );
}

function AppScreensProvider({
  children,
  screens,
}: PropsWithChildren<{ screens: AppScreenRegistry }>) {
  return (
    <AppScreensContext.Provider value={screens}>
      {children}
    </AppScreensContext.Provider>
  );
}

function useAppScreens(): AppScreenRegistry {
  const screens = useContext(AppScreensContext);

  if (screens === null) {
    throw new Error('AppNavigator 안에서만 화면 registry를 사용할 수 있습니다.');
  }

  return screens;
}

function HomeStackNavigator() {
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

function MapStackNavigator() {
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

function RegionalGuideStackNavigator() {
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

function FavoritesStackNavigator() {
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

const TAB_COMPONENTS = {
  [BOTTOM_TAB_ROUTES.HOME]: HomeStackNavigator,
  [BOTTOM_TAB_ROUTES.MAP]: MapStackNavigator,
  [BOTTOM_TAB_ROUTES.REGIONAL_GUIDE]: RegionalGuideStackNavigator,
  [BOTTOM_TAB_ROUTES.FAVORITES]: FavoritesStackNavigator,
} satisfies Record<keyof AppTabParamList, ComponentType>;
