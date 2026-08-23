import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../../App';
import type { HomeCategoryStore } from '../home-category-store';
import {
  filterHomeQuickCategories,
  getQuickCategoryGridMetrics,
  type HomeQuickCategory,
} from '../item-home';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'HomeCategorySettings'
> &
  Readonly<{ homeCategoryStore: HomeCategoryStore }>;

export function HomeCategorySettingsScreen({
  homeCategoryStore,
  navigation,
}: Props) {
  const { height, width } = useWindowDimensions();
  const maxSelectedCount = getQuickCategoryGridMetrics(
    width,
    height,
  ).collapsedCategoryCount;
  const state = useSyncExternalStore(
    homeCategoryStore.subscribe,
    homeCategoryStore.getSnapshot,
    homeCategoryStore.getSnapshot,
  );
  const [query, setQuery] = useState('');
  const [limitMessage, setLimitMessage] = useState<string>();
  const selectedIds = state.selectedIds.slice(0, maxSelectedCount);
  const categories = filterHomeQuickCategories(query);

  useEffect(() => {
    if (state.status === 'ready') {
      void homeCategoryStore.limit(maxSelectedCount);
    }
  }, [homeCategoryStore, maxSelectedCount, state.status]);

  const handleBack = useCallback(() => {
    if (query.trim().length > 0) {
      setQuery('');
    } else {
      navigation.goBack();
    }
  }, [navigation, query]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          handleBack();
          return true;
        },
      );

      return () => subscription.remove();
    }, [handleBack]),
  );

  async function toggleCategory(category: HomeQuickCategory) {
    const isSelected = selectedIds.includes(category.id);
    if (!isSelected && selectedIds.length >= maxSelectedCount) {
      setLimitMessage(`최대 ${maxSelectedCount}개까지만 선택할 수 있어요.`);
      return;
    }

    setLimitMessage(undefined);
    const result = await homeCategoryStore.toggle(
      category.id,
      maxSelectedCount,
    );
    if (result === 'limit-reached') {
      setLimitMessage(`최대 ${maxSelectedCount}개까지만 선택할 수 있어요.`);
    }
  }

  return (
    <SafeAreaView
      edges={['top', 'right', 'bottom', 'left']}
      style={styles.safeArea}
    >
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="품목 검색으로 돌아가기"
          accessibilityRole="button"
          onPress={handleBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Text allowFontScaling={false} style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.topBarTitle}>
          홈 표시 카테고리
        </Text>
        <View style={styles.topBarSpacer} />
      </View>

      {state.status === 'loading' ? (
        <View accessibilityLiveRegion="polite" style={styles.statusPanel}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.statusTitle}>선택 상태를 불러오고 있어요.</Text>
        </View>
      ) : null}

      {state.status === 'error' ? (
        <View accessibilityLiveRegion="assertive" style={styles.statusPanel}>
          <Text accessibilityRole="header" style={styles.statusTitle}>
            선택 상태를 불러오지 못했어요.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void homeCategoryStore.retryLoad()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonLabel}>다시 시도</Text>
          </Pressable>
        </View>
      ) : null}

      {state.status === 'ready' ? (
        <FlatList
          contentContainerStyle={styles.list}
          data={categories}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(category) => category.id}
          ListEmptyComponent={
            <View accessibilityLiveRegion="polite" style={styles.emptyPanel}>
              <Text accessibilityRole="header" style={styles.statusTitle}>
                검색 결과가 없어요.
              </Text>
              <Text style={styles.statusDescription}>
                다른 분류명으로 다시 검색해보세요.
              </Text>
            </View>
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.description}>
                홈에서 먼저 볼 분류를 선택하세요. 선택한 순서대로 앞에 표시됩니다.
              </Text>
              <View style={styles.searchRow}>
                <TextInput
                  accessibilityLabel="홈 표시 카테고리 검색"
                  autoCorrect={false}
                  onChangeText={setQuery}
                  placeholder="분류명 검색"
                  placeholderTextColor={colors.outline}
                  returnKeyType="search"
                  style={styles.searchInput}
                  value={query}
                />
                {query.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setQuery('')}
                    style={({ pressed }) => [
                      styles.cancelButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.cancelLabel}>취소</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text accessibilityLiveRegion="polite" style={styles.summary}>
                홈에 표시 {selectedIds.length}/{maxSelectedCount}
              </Text>
              {limitMessage ? (
                <Text
                  accessibilityLiveRegion="assertive"
                  style={styles.warningText}
                >
                  {limitMessage}
                </Text>
              ) : null}
              {state.error?.type === 'save' ? (
                <View
                  accessibilityLiveRegion="assertive"
                  style={styles.errorPanel}
                >
                  <Text style={styles.errorText}>
                    선택 상태를 저장하지 못했어요.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void homeCategoryStore.retrySave()}
                    style={({ pressed }) => [
                      styles.retryButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.retryLabel}>다시 시도</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            const isSelected = selectedIds.includes(item.id);
            const isPending = state.pendingIds.includes(item.id);
            const isAtLimit =
              !isSelected && selectedIds.length >= maxSelectedCount;
            const isInteractionDisabled =
              isPending || state.error?.type === 'save';

            return (
              <Pressable
                accessibilityHint={
                  isAtLimit
                    ? `최대 ${maxSelectedCount}개까지 선택할 수 있습니다.`
                    : undefined
                }
                accessibilityLabel={`${item.label} 홈에 표시`}
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: isSelected,
                  disabled: isInteractionDisabled,
                }}
                disabled={isInteractionDisabled}
                onPress={() => void toggleCategory(item)}
                style={({ pressed }) => [
                  styles.categoryRow,
                  isAtLimit && styles.categoryRowAtLimit,
                  isInteractionDisabled && styles.categoryRowDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={styles.symbolBox}
                >
                  <Text allowFontScaling={false} style={styles.symbol}>
                    {item.symbol}
                  </Text>
                </View>
                <Text style={styles.categoryLabel}>{item.label}</Text>
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[
                    styles.selectionControl,
                    isSelected && styles.selectionControlSelected,
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.selectionLabel,
                      isSelected && styles.selectionLabelSelected,
                    ]}
                  >
                    {isSelected ? '✓' : '+'}
                  </Text>
                </View>
              </Pressable>
            );
          }}
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
  list: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  listHeader: { gap: spacing.md, paddingBottom: spacing.sm },
  description: {
    color: colors.onSurfaceVariant,
    fontSize: 16,
    lineHeight: 24,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchInput: {
    flex: 1,
    minHeight: 52,
    borderColor: colors.outlineVariant,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: colors.surface,
    color: colors.onSurface,
    fontSize: 17,
    paddingHorizontal: spacing.md,
  },
  cancelButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  summary: {
    borderRadius: 14,
    backgroundColor: colors.surfaceHigh,
    color: colors.onSurface,
    fontSize: 16,
    fontWeight: '700',
    padding: spacing.md,
  },
  warningText: {
    color: colors.error,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  errorPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 14,
    backgroundColor: colors.errorContainer,
    padding: spacing.md,
  },
  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 15,
    lineHeight: 22,
  },
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  retryLabel: { color: colors.error, fontSize: 15, fontWeight: '800' },
  categoryRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderColor: colors.outlineVariant,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  categoryRowAtLimit: { opacity: 0.65 },
  categoryRowDisabled: { opacity: 0.5 },
  symbolBox: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.primaryContainer,
  },
  symbol: { color: colors.primary, fontSize: 21, fontWeight: '800' },
  categoryLabel: {
    flex: 1,
    color: colors.onSurface,
    fontSize: 16,
    fontWeight: '700',
  },
  selectionControl: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.outline,
    borderRadius: 10,
    borderWidth: 1,
  },
  selectionControlSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  selectionLabel: { color: colors.onSurfaceVariant, fontSize: 20 },
  selectionLabelSelected: { color: colors.onPrimary, fontWeight: '800' },
  statusPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  emptyPanel: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  statusTitle: {
    color: colors.onSurface,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  statusDescription: {
    color: colors.onSurfaceVariant,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonLabel: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: { transform: [{ scale: 0.97 }] },
});
