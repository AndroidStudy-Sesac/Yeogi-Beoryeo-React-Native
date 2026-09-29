import { NavigationContainer } from '@react-navigation/native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RegionalGuideFavoritesProvider } from '../../features/regional-guide/presentation/RegionalGuideFavoritesContext';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <RegionalGuideFavoritesProvider>
        <NavigationContainer>{children}</NavigationContainer>
      </RegionalGuideFavoritesProvider>
    </SafeAreaProvider>
  );
}
