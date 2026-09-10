import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import type { ComponentType, Dispatch, SetStateAction } from 'react';

import { AppBottomTabBar } from './AppBottomTabBar';
import { BottomTabIcon } from './BottomTabIcon';
import {
  BOTTOM_TAB_ITEMS,
  getBottomTabNavigationAction,
  getScreenSelectedBottomTab,
} from './navigationPolicy';
import {
  APP_SCREEN_ROUTES,
  BOTTOM_TAB_ROUTES,
  type AppTabParamList,
} from './routes';
import { FavoritesStackNavigator } from './stacks/FavoritesStackNavigator';
import { HomeStackNavigator } from './stacks/HomeStackNavigator';
import { MapStackNavigator } from './stacks/MapStackNavigator';
import { RegionalGuideStackNavigator } from './stacks/RegionalGuideStackNavigator';

type AppBottomTabNavigatorProps = {
  isBottomTabBarVisible: boolean;
  setBottomTabBarVisible: Dispatch<SetStateAction<boolean>>;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

export function AppBottomTabNavigator({
  isBottomTabBarVisible,
  setBottomTabBarVisible,
}: AppBottomTabNavigatorProps) {
  return (
    <Tab.Navigator
      backBehavior="initialRoute"
      initialRouteName={BOTTOM_TAB_ROUTES.HOME}
      tabBar={props => <AppBottomTabBar {...props} />}
      screenListeners={({ navigation, route }) => ({
        tabPress: event => {
          const state = navigation.getState();
          const targetTab = route.name;
          const shouldReset =
            targetTab === BOTTOM_TAB_ROUTES.HOME ||
            state.routes[state.index].key === route.key ||
            getBottomTabNavigationAction(
              getScreenSelectedBottomTab(state),
              targetTab,
            ) === 'RESET_TO_ROOT';

          event.preventDefault();
          setBottomTabBarVisible(true);
          navigation.dispatch(
            CommonActions.reset({
              ...state,
              routes: state.routes.map(tab => {
                // Tab clicks return through the search root, while direct
                // feature navigation can retain its originating screen.
                if (tab.name === BOTTOM_TAB_ROUTES.HOME && tab.state) {
                  return {
                    ...tab,
                    params: undefined,
                    state: {
                      ...tab.state,
                      index: 0,
                      routes: [tab.state.routes[0]],
                    },
                  };
                }
                if (tab.key !== route.key || !shouldReset) return tab;
                if (targetTab === BOTTOM_TAB_ROUTES.HOME && !tab.state) {
                  return tab;
                }
                return {
                  ...tab,
                  params: undefined,
                  state: {
                    index: 0,
                    routes: [{ name: TAB_ROOT_SCREENS[targetTab] }],
                  },
                };
              }),
            }),
          );
          navigation.dispatch(CommonActions.navigate(targetTab));
        },
      })}
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
  );
}

const TAB_COMPONENTS = {
  [BOTTOM_TAB_ROUTES.HOME]: HomeStackNavigator,
  [BOTTOM_TAB_ROUTES.MAP]: MapStackNavigator,
  [BOTTOM_TAB_ROUTES.REGIONAL_GUIDE]: RegionalGuideStackNavigator,
  [BOTTOM_TAB_ROUTES.FAVORITES]: FavoritesStackNavigator,
} satisfies Record<keyof AppTabParamList, ComponentType>;

const TAB_ROOT_SCREENS = {
  [BOTTOM_TAB_ROUTES.HOME]: APP_SCREEN_ROUTES.ITEM_SEARCH,
  [BOTTOM_TAB_ROUTES.MAP]: APP_SCREEN_ROUTES.MAP,
  [BOTTOM_TAB_ROUTES.REGIONAL_GUIDE]: APP_SCREEN_ROUTES.REGIONAL_GUIDE,
  [BOTTOM_TAB_ROUTES.FAVORITES]: APP_SCREEN_ROUTES.FAVORITES,
} as const;
