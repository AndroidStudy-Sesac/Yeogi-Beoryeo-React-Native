import { NavigationContainer, type InitialState, type NavigationState } from '@react-navigation/native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export function AppProviders({ children, initialState, onStateChange }: PropsWithChildren<{
  initialState?: InitialState;
  onStateChange?: (state: NavigationState | undefined) => void;
}>) {
  return (
    <SafeAreaProvider>
      <NavigationContainer initialState={initialState} onStateChange={onStateChange}>{children}</NavigationContainer>
    </SafeAreaProvider>
  );
}
