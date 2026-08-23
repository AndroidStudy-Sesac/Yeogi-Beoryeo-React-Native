import { useCallback, useSyncExternalStore } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../../App';
import { getBundledItemGuide } from '../catalog-data';
import type { ItemGuide } from '../catalog';
import type { FavoriteStore } from '../favorite-store';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemDetail'> &
  Readonly<{ favoriteStore: FavoriteStore }>;

function categoryLabel(item: ItemGuide): string {
  const categoryPath = item.categoryPaths[0];
  return categoryPath?.[categoryPath.length - 1] ?? '기타';
}

function DetailSection({
  title,
  lines,
}: Readonly<{ title: string; lines: readonly string[] }>) {
  if (lines.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {lines.map((line, index) => (
        <View key={`${title}-${index}`} style={styles.lineRow}>
          <View style={styles.bullet} />
          <Text style={styles.line}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

export function ItemDetailScreen({ favoriteStore, navigation, route }: Props) {
  const favoriteState = useSyncExternalStore(
    favoriteStore.subscribe,
    favoriteStore.getSnapshot,
    favoriteStore.getSnapshot,
  );
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        navigation.goBack();
        return true;
      });

      return () => subscription.remove();
    }, [navigation]),
  );

  let item: ItemGuide | undefined;
  try {
    item = getBundledItemGuide(route.params.itemId);
  } catch {
    item = undefined;
  }

  const isFavorite = item
    ? favoriteState.itemIds.includes(item.id)
    : false;
  const isFavoritePending = item
    ? favoriteState.pendingItemIds.includes(item.id)
    : false;
  const isFavoriteDisabled =
    item === undefined || favoriteState.status !== 'ready' || isFavoritePending;
  const favoriteLabel =
    favoriteState.status === 'loading'
      ? '즐겨찾기 불러오는 중'
      : favoriteState.status === 'error'
        ? '즐겨찾기 사용 불가'
        : isFavoritePending
          ? '즐겨찾기 저장 중'
          : isFavorite
            ? '즐겨찾기 해제'
            : '즐겨찾기 추가';
  const favoriteAccessibilityState = {
    disabled: isFavoriteDisabled,
    ...(favoriteState.status === 'loading' ? { busy: true } : {}),
    ...(favoriteState.status === 'ready' ? { selected: isFavorite } : {}),
  };

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="이전 화면으로 돌아가기"
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text allowFontScaling={false} style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.topBarTitle}>
          품목 상세
        </Text>
        {item ? (
          <Pressable
            accessibilityLabel={favoriteLabel}
            accessibilityRole="button"
            accessibilityState={favoriteAccessibilityState}
            disabled={isFavoriteDisabled}
            onPress={() => void favoriteStore.toggle(item.id)}
            style={({ pressed }) => [
              styles.favoriteButton,
              isFavoriteDisabled && styles.favoriteButtonDisabled,
              pressed && !isFavoriteDisabled && styles.pressed,
            ]}
          >
            <Text
              allowFontScaling={false}
              style={[
                styles.favoriteIcon,
                isFavorite && styles.favoriteIconSelected,
              ]}
            >
              {isFavorite ? '★' : '☆'}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.favoriteButton} />
        )}
      </View>

      {item ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.itemHeader}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.iconContainer}
            >
              <Text allowFontScaling={false} style={styles.recycleSymbol}>♻</Text>
            </View>
            <View style={styles.headerText}>
              <Text accessibilityRole="header" style={styles.itemName}>
                {item.name}
              </Text>
              <View style={styles.categoryChip}>
                <Text style={styles.categoryLabel}>{categoryLabel(item)}</Text>
              </View>
            </View>
          </View>

          {favoriteState.status === 'error' ? (
            <View accessibilityLiveRegion="assertive" style={styles.favoriteError}>
              <Text style={styles.favoriteErrorText}>
                즐겨찾기를 불러오지 못했어요.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void favoriteStore.retryLoad()}
                style={({ pressed }) => [
                  styles.favoriteRetryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.favoriteRetryLabel}>다시 시도</Text>
              </Pressable>
            </View>
          ) : favoriteState.error?.type === 'save' &&
            favoriteState.error.itemIds.includes(item.id) ? (
            <View accessibilityLiveRegion="assertive" style={styles.favoriteError}>
              <Text style={styles.favoriteErrorText}>
                즐겨찾기를 저장하지 못했어요. 다시 눌러주세요.
              </Text>
            </View>
          ) : null}

          <DetailSection title="배출 방법" lines={item.dischargeMethods} />
          <DetailSection title="특징" lines={item.features} />
          <DetailSection title="유의사항" lines={item.notes} />

          <View style={styles.notice}>
            <Text accessibilityRole="header" style={styles.noticeTitle}>
              지역별 배출 기준을 확인하세요.
            </Text>
            <Text style={styles.noticeText}>
              실제 배출 방법은 지역에 따라 다를 수 있어요. 거주지의 안내를 함께 확인하세요.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <View accessibilityLiveRegion="assertive" style={styles.missingState}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            품목 정보를 불러오지 못했어요.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.returnButton, pressed && styles.pressed]}
          >
            <Text style={styles.returnLabel}>이전 화면으로 돌아가기</Text>
          </Pressable>
        </View>
      )}
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
  backButton: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: colors.onSurface, fontSize: 40, lineHeight: 44 },
  topBarTitle: { flex: 1, color: colors.onSurface, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  favoriteButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButtonDisabled: { opacity: 0.45 },
  favoriteIcon: { color: colors.outline, fontSize: 30 },
  favoriteIconSelected: { color: colors.favorite },
  content: { gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xl },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  iconContainer: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: colors.primaryContainer,
  },
  recycleSymbol: { color: colors.primary, fontSize: 38 },
  headerText: { flex: 1, alignItems: 'flex-start', gap: spacing.sm },
  itemName: { color: colors.onSurface, fontSize: 28, fontWeight: '800' },
  categoryChip: { borderRadius: 12, backgroundColor: colors.secondaryContainer, paddingHorizontal: 12, paddingVertical: 6 },
  categoryLabel: { color: colors.onPrimaryContainer, fontSize: 14, fontWeight: '700' },
  favoriteError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 14,
    backgroundColor: colors.errorContainer,
    padding: spacing.md,
  },
  favoriteErrorText: {
    flex: 1,
    color: colors.error,
    fontSize: 15,
    lineHeight: 22,
  },
  favoriteRetryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.error,
    paddingHorizontal: spacing.md,
  },
  favoriteRetryLabel: { color: colors.onPrimary, fontSize: 15, fontWeight: '800' },
  section: {
    gap: spacing.sm,
    borderColor: colors.outlineVariant,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  sectionTitle: { color: colors.onSurface, fontSize: 19, fontWeight: '800' },
  lineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  bullet: { width: 6, height: 6, marginTop: 8, borderRadius: 3, backgroundColor: colors.primary },
  line: { flex: 1, color: colors.onSurfaceVariant, fontSize: 16, lineHeight: 24 },
  notice: { gap: spacing.sm, borderRadius: 18, backgroundColor: colors.surfaceHigh, padding: spacing.md },
  noticeTitle: { color: colors.onSurface, fontSize: 17, fontWeight: '800' },
  noticeText: { color: colors.onSurfaceVariant, fontSize: 15, lineHeight: 22 },
  missingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  returnButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
  },
  returnLabel: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  pressed: { transform: [{ scale: 0.96 }] },
});
