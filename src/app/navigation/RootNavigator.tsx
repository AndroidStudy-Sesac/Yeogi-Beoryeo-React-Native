import { useRoute, type RouteProp } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';

import { RegionalGuideScreen } from '../../features/regional-guide/presentation/RegionalGuideScreen';
import { AppNavigator, type AppScreenRegistry } from './AppNavigator';
import type { RegionalGuideStackParamList } from './routes';

function BootstrapScreen() {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        여기버려
      </Text>
      <Text style={styles.description}>공통 개발 환경이 준비되었습니다.</Text>
    </View>
  );
}

export function RootNavigator() {
  return <AppNavigator screens={appScreens} />;
}

function RegionalGuideRouteScreen() {
  const route = useRoute<
    RouteProp<RegionalGuideStackParamList, 'RegionalGuide'>
  >();
  return (
    <RegionalGuideScreen
      initialQuery={
        route.params?.initialKeyword ?? route.params?.initialAddress ?? ''
      }
    />
  );
}

const appScreens = {
  Favorites: BootstrapScreen,
  ItemGuideDetail: BootstrapScreen,
  ItemSearch: BootstrapScreen,
  ItemUsefulGuide: BootstrapScreen,
  Map: BootstrapScreen,
  QuickCategorySettings: BootstrapScreen,
  RegionalGuide: RegionalGuideRouteScreen,
  Settings: BootstrapScreen,
  SettingsDetail: BootstrapScreen,
} satisfies AppScreenRegistry;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#111111',
    fontSize: 28,
    fontWeight: '700',
  },
  description: {
    color: '#444444',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
});
