import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator } from 'react-native';

import { RootNavigator } from './navigation/RootNavigator';
import { useSearchSession } from './navigation/useSearchSession';
import { AppProviders } from './providers/AppProviders';

export default function App({ searchSessionId }: { searchSessionId?: string; [key: string]: unknown } = {}) {
  const session = useSearchSession(searchSessionId);
  if (!session.ready) return <ActivityIndicator accessibilityLabel="로딩 중" />;
  return (
    <AppProviders initialState={session.initialState} onStateChange={session.onStateChange}>
      <RootNavigator />
      <StatusBar style="auto" />
    </AppProviders>
  );
}
