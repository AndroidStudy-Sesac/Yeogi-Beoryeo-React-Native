import { NavigationContainer, type InitialState, type NavigationState } from '@react-navigation/native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ItemPreferencesProvider } from '../../features/item-search/presentation/ItemPreferencesContext';
import { ItemPreferenceFeedback } from '../../features/item-search/presentation/ItemFavoritesScreen';
import { RegionalGuideFavoritesProvider } from '../../features/regional-guide/presentation/RegionalGuideFavoritesContext';
import { HomeRegionalGuideRepresentativeProvider } from '../../features/regional-guide/presentation/HomeRegionalGuideRepresentativeContext';

export function AppProviders({ children, initialState, onStateChange }: PropsWithChildren<{
  initialState?: InitialState;
  onStateChange?: (state: NavigationState | undefined) => void;
}>) {
  return (
    <SafeAreaProvider>
      <ItemPreferencesProvider>
        <RegionalGuideFavoritesProvider>
          <HomeRegionalGuideRepresentativeProvider>
            <NavigationContainer initialState={initialState} onStateChange={onStateChange}>{children}</NavigationContainer>
          </HomeRegionalGuideRepresentativeProvider>
        </RegionalGuideFavoritesProvider>
        <ItemPreferenceFeedback />
      </ItemPreferencesProvider>
    </SafeAreaProvider>
  );
}
