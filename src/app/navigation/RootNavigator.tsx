import {
  CommonActions,
  StackActions,
  useNavigation,
  usePreventRemove,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FavoritesScreen } from '../../features/favorites/presentation/FavoritesScreen';
import { RegionalGuideScreen } from '../../features/regional-guide/presentation/RegionalGuideScreen';
import { RegionalGuideDetailScreen } from '../../features/regional-guide/presentation/RegionalGuideDetailScreen';
import { useRegionalGuideFavorites } from '../../features/regional-guide/presentation/RegionalGuideFavoritesContext';
import { AppNavigator, type AppScreenRegistry } from './AppNavigator';
import { getRegionalGuideBottomTab } from './navigationPolicy';
import {
  APP_SCREEN_ROUTES,
  BOTTOM_TAB_ROUTES,
  type AppTabParamList,
  type RegionalGuideDetailSource,
  type RegionalGuideStackParamList,
} from './routes';
import { useFocusedHardwareBack } from './useFocusedHardwareBack';

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
  const favoriteStore = useRegionalGuideFavorites();
  const favoriteTargetId = route.params?.initialFavoriteTargetId;
  const isFavoriteReentry =
    route.params?.entrySource === 'FAVORITES' && Boolean(favoriteTargetId);
  const favorite = favoriteStore.favorites.find(
    item => item.targetId === favoriteTargetId,
  );
  const [searchBackHandler, setSearchBackHandler] = useState<
    (() => boolean) | undefined
  >();
  const registerSearchBackHandler = useCallback(
    (handler?: () => boolean) => {
      setSearchBackHandler(handler ? () => handler : undefined);
    },
    [],
  );
  useFocusedHardwareBack(searchBackHandler);
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

  useEffect(() => {
    if (!isFavoriteReentry || favoriteStore.loadState !== 'ready' || !favorite) {
      return;
    }
    navigation.dispatch(
      StackActions.replace(APP_SCREEN_ROUTES.REGIONAL_GUIDE_DETAIL, {
        initialFavoriteTargetId: favorite.targetId,
        selection: favorite.selection,
        source: 'FAVORITES',
      }),
    );
  }, [favorite, favoriteStore.loadState, isFavoriteReentry, navigation]);

  if (isFavoriteReentry) {
    if (favoriteStore.loadState === 'loading' || favorite) {
      return (
        <EntryState
          description="저장한 조건으로 최신 지역 가이드를 조회할 준비를 하고 있어요."
          label="저장한 지역 가이드 준비 중"
          loading
          title="저장한 가이드를 여는 중입니다."
        />
      );
    }
    if (favoriteStore.loadState === 'error') {
      return (
        <EntryState
          actionLabel="다시 시도"
          description="저장 데이터를 불러오지 못했습니다."
          label="저장 데이터 불러오기 실패"
          onAction={() => void favoriteStore.retryLoad()}
          title="저장한 가이드를 열 수 없어요."
        />
      );
    }
    return (
      <EntryState
        actionLabel="저장 목록으로 돌아가기"
        description="지원하지 않거나 잘못된 저장 데이터는 앱에서 제외됩니다."
        label="잘못된 지역 가이드 저장 데이터"
        onAction={() => navigation.goBack()}
        title="저장 정보를 찾을 수 없어요."
      />
    );
  }
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
  useFocusedHardwareBack(candidateBackHandler);
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
  const reselectRegion = useCallback(() => {
    navigation
      .getParent<NavigationProp<AppTabParamList>>()
      ?.navigate(BOTTOM_TAB_ROUTES.REGIONAL_GUIDE, {
        screen: APP_SCREEN_ROUTES.REGIONAL_GUIDE,
      });
  }, [navigation]);

  return (
    <RegionalGuideDetailScreen
      initialFavoriteTargetId={route.params.initialFavoriteTargetId}
      onBack={leaveDetail}
      onCandidateBackHandlerChange={registerCandidateBackHandler}
      onReselectRegion={reselectRegion}
      selection={route.params.selection}
    />
  );
}

function EntryState({
  actionLabel,
  description,
  label,
  loading = false,
  onAction,
  title,
}: Readonly<{
  actionLabel?: string;
  description: string;
  label: string;
  loading?: boolean;
  onAction?: () => void;
  title: string;
}>) {
  return (
    <View
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={styles.container}
    >
      {loading ? <ActivityIndicator color="#2E7D32" /> : null}
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={onAction}
          style={styles.action}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
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
  Favorites: FavoritesScreen,
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
  action: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    marginTop: 8,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  actionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
