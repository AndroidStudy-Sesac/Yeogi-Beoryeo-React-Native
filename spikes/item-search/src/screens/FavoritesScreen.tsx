import { useCallback, useSyncExternalStore } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../../App';
import { getBundledItemGuide } from '../catalog-data';
import {
  resolveFavoriteItems,
  type FavoriteStore,
} from '../favorite-store';
import { colors, spacing } from '../theme';
import { ItemResultCard } from './ItemResultCard';

type Props = NativeStackScreenProps<RootStackParamList, 'Favorites'> &
  Readonly<{ favoriteStore: FavoriteStore }>;

export function FavoritesScreen({ favoriteStore, navigation }: Props) {
  const state = useSyncExternalStore(
    favoriteStore.subscribe,
    favoriteStore.getSnapshot,
    favoriteStore.getSnapshot,
  );
  const items = resolveFavoriteItems(state.itemIds, getBundledItemGuide);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        navigation.goBack();
        return true;
      });

      return () => subscription.remove();
    }, [navigation]),
  );

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="품목 검색으로 돌아가기"
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text allowFontScaling={false} style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.topBarTitle}>
          즐겨찾기
        </Text>
        <View style={styles.topBarSpacer} />
      </View>

      {state.status === 'loading' ? (
        <View accessibilityLiveRegion="polite" style={styles.statusPanel}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.statusTitle}>즐겨찾기를 불러오고 있어요.</Text>
        </View>
      ) : null}

      {state.status === 'error' ? (
        <View accessibilityLiveRegion="assertive" style={styles.statusPanel}>
          <Text accessibilityRole="header" style={styles.statusTitle}>
            즐겨찾기를 불러오지 못했어요.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void favoriteStore.retryLoad()}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Text style={styles.retryLabel}>다시 시도</Text>
          </Pressable>
        </View>
      ) : null}

      {state.status === 'ready' && items.length === 0 ? (
        <View accessibilityLiveRegion="polite" style={styles.statusPanel}>
          <Text accessibilityRole="header" style={styles.statusTitle}>
            아직 즐겨찾기한 품목이 없어요.
          </Text>
          <Text style={styles.statusDescription}>
            품목 상세 화면에서 별을 누르면 여기에 모아볼 수 있어요.
          </Text>
        </View>
      ) : null}

      {state.status === 'ready' && items.length > 0 ? (
        <FlatList
          contentContainerStyle={styles.list}
          data={items}
          ItemSeparatorComponent={() => <View style={styles.itemGap} />}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ItemResultCard
              item={item}
              onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
            />
          )}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  topBar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomColor: colors.outlineVariant,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { color: colors.onSurface, fontSize: 40, lineHeight: 44 },
  topBarTitle: {
    flex: 1,
    color: colors.onSurface,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  topBarSpacer: { width: 56 },
  statusPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  statusTitle: {
    color: colors.onSurface,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  statusDescription: {
    maxWidth: 320,
    color: colors.onSurfaceVariant,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
  },
  retryLabel: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  list: { padding: spacing.md, paddingBottom: spacing.xl },
  itemGap: { height: spacing.sm },
  pressed: { transform: [{ scale: 0.96 }] },
});
