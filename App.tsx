import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RegionalGuideScreen } from './src/features/regional-guide/presentation/RegionalGuideScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <RegionalGuideScreen />
    </SafeAreaProvider>
  );
}
