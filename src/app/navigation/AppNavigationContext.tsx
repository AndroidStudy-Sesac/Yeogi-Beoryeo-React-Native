import { useFocusEffect } from '@react-navigation/native';
import {
  createContext,
  useCallback,
  useContext,
  type ComponentType,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from 'react';

import type { AppScreenRouteName } from './routes';

export type AppScreenRegistry = Record<AppScreenRouteName, ComponentType>;

const AppScreensContext = createContext<AppScreenRegistry | null>(null);
export const BottomTabBarVisibilityContext = createContext<Dispatch<
  SetStateAction<boolean>
> | null>(null);

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

export function AppScreensProvider({
  children,
  screens,
}: PropsWithChildren<{ screens: AppScreenRegistry }>) {
  return (
    <AppScreensContext.Provider value={screens}>
      {children}
    </AppScreensContext.Provider>
  );
}

export function useAppScreens(): AppScreenRegistry {
  const screens = useContext(AppScreensContext);

  if (screens === null) {
    throw new Error('AppNavigator 안에서만 화면 registry를 사용할 수 있습니다.');
  }

  return screens;
}
