import { useState } from 'react';

import { AppBottomTabNavigator } from './AppBottomTabNavigator';
import {
  AppScreensProvider,
  BottomTabBarVisibilityContext,
  type AppScreenRegistry,
} from './AppNavigationContext';

export {
  type AppScreenRegistry,
  useBottomTabBarVisibility,
} from './AppNavigationContext';

export function AppNavigator({ screens }: { screens: AppScreenRegistry }) {
  const [isBottomTabBarVisible, setBottomTabBarVisible] = useState(true);

  return (
    <AppScreensProvider screens={screens}>
      <BottomTabBarVisibilityContext.Provider value={setBottomTabBarVisible}>
        <AppBottomTabNavigator
          isBottomTabBarVisible={isBottomTabBarVisible}
          setBottomTabBarVisible={setBottomTabBarVisible}
        />
      </BottomTabBarVisibilityContext.Provider>
    </AppScreensProvider>
  );
}
