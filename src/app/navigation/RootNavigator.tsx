import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RegionalGuideScreen } from '../../features/regional-guide/presentation/RegionalGuideScreen';
import { RegionalGuideDetailScreen } from '../../features/regional-guide/presentation/RegionalGuideDetailScreen';
import { AppNavigator, type AppScreenRegistry } from './AppNavigator';
import { getRegionalGuideBottomTab } from './navigationPolicy';
import {
  APP_SCREEN_ROUTES,
  BOTTOM_TAB_ROUTES,
  type RegionalGuideDetailSource,
  type RegionalGuideStackParamList,
} from './routes';

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
  const navigation =
    useNavigation<NavigationProp<RegionalGuideStackParamList>>();
  const route = useRoute<
    RouteProp<RegionalGuideStackParamList, 'RegionalGuide'>
  >();
  const source = regionalGuideDetailSource(route.params);
  const openDetail = useCallback(
    (selection: RegionalGuideStackParamList['RegionalGuideDetail']['selection']) =>
      navigation.navigate(APP_SCREEN_ROUTES.REGIONAL_GUIDE_DETAIL, {
        selection,
        source,
      }),
    [navigation, source],
  );
  return (
    <RegionalGuideScreen
      initialQuery={
        route.params?.initialKeyword ?? route.params?.initialAddress ?? ''
      }
      onRegionSelected={openDetail}
    />
  );
}

function RegionalGuideDetailRouteScreen() {
  const navigation = useNavigation();
  const route = useRoute<
    RouteProp<RegionalGuideStackParamList, 'RegionalGuideDetail'>
  >();
  return (
    <RegionalGuideDetailScreen
      onBack={() => navigation.goBack()}
      selection={route.params.selection}
    />
  );
}

function regionalGuideDetailSource(
  params: RegionalGuideStackParamList['RegionalGuide'],
): RegionalGuideDetailSource {
  const tab = getRegionalGuideBottomTab(params);
  if (tab === BOTTOM_TAB_ROUTES.FAVORITES) return 'FAVORITES';
  if (tab === BOTTOM_TAB_ROUTES.MAP) return 'MAP';
  return 'REGIONAL_GUIDE';
}

const appScreens = {
  Favorites: BootstrapScreen,
  ItemGuideDetail: BootstrapScreen,
  ItemSearch: BootstrapScreen,
  ItemUsefulGuide: BootstrapScreen,
  Map: BootstrapScreen,
  QuickCategorySettings: BootstrapScreen,
  RegionalGuide: RegionalGuideRouteScreen,
  RegionalGuideDetail: RegionalGuideDetailRouteScreen,
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
