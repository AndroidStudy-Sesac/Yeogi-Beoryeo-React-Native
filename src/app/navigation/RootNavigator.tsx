import {
  CommonActions,
  useFocusEffect,
  useNavigation,
  usePreventRemove,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';

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
  const [searchBackHandler, setSearchBackHandler] = useState<
    (() => boolean) | undefined
  >();
  const registerSearchBackHandler = useCallback(
    (handler?: () => boolean) => {
      setSearchBackHandler(handler ? () => handler : undefined);
    },
    [],
  );
  useFocusEffect(
    useCallback(() => {
      if (!searchBackHandler) return undefined;
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        searchBackHandler,
      );
      return () => subscription.remove();
    }, [searchBackHandler]),
  );
  const openDetail = useCallback(
    (
      selection: RegionalGuideStackParamList['RegionalGuideDetail']['selection'],
      options?: Readonly<{ restoreSearchCandidatesOnBack: boolean }>,
    ) =>
      navigation.navigate(APP_SCREEN_ROUTES.REGIONAL_GUIDE_DETAIL, {
        selection,
        source,
        restoreSearchCandidatesOnBack:
          options?.restoreSearchCandidatesOnBack ?? false,
      }),
    [navigation, source],
  );
  return (
    <RegionalGuideScreen
      initialQuery={
        route.params?.initialKeyword ?? route.params?.initialAddress ?? ''
      }
      onSearchBackHandlerChange={registerSearchBackHandler}
      onRegionSelected={openDetail}
      restoreSearchCandidatesRequestId={
        route.params?.restoreSearchCandidatesRequestId
      }
    />
  );
}

function RegionalGuideDetailRouteScreen() {
  const navigation =
    useNavigation<NavigationProp<RegionalGuideStackParamList>>();
  const route = useRoute<
    RouteProp<RegionalGuideStackParamList, 'RegionalGuideDetail'>
  >();
  const [candidateBackHandler, setCandidateBackHandler] = useState<
    (() => boolean) | undefined
  >();
  const allowRemovalRef = useRef(false);
  const registerCandidateBackHandler = useCallback(
    (handler?: () => boolean) => {
      setCandidateBackHandler(handler ? () => handler : undefined);
    },
    [],
  );
  const shouldRestoreSearchCandidates =
    route.params.restoreSearchCandidatesOnBack === true;
  const markSearchCandidatesForRestore = useCallback(() => {
    const state = navigation.getState();
    const previousRoute = state.routes[state.index - 1];
    if (previousRoute?.name !== APP_SCREEN_ROUTES.REGIONAL_GUIDE) return;

    navigation.dispatch({
      ...CommonActions.setParams({
        restoreSearchCandidatesRequestId: nextRestoreSearchCandidatesRequestId++,
      }),
      source: previousRoute.key,
    });
  }, [navigation]);
  const shouldPreventRemoval =
    Boolean(candidateBackHandler) || shouldRestoreSearchCandidates;
  usePreventRemove(shouldPreventRemoval, ({ data }) => {
    if (allowRemovalRef.current) {
      allowRemovalRef.current = false;
      navigation.dispatch(data.action);
      return;
    }
    if (candidateBackHandler?.()) return;
    if (shouldRestoreSearchCandidates) {
      markSearchCandidatesForRestore();
      allowRemovalRef.current = true;
      navigation.dispatch(data.action);
    }
  });
  const leaveDetail = useCallback(() => {
    if (shouldPreventRemoval) allowRemovalRef.current = true;
    navigation.goBack();
  }, [navigation, shouldPreventRemoval]);

  return (
    <RegionalGuideDetailScreen
      onBack={leaveDetail}
      onCandidateBackHandlerChange={registerCandidateBackHandler}
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

let nextRestoreSearchCandidatesRequestId = Date.now();

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
