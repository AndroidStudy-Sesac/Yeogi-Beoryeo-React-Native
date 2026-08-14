import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ItemSearchViewModel,
  type ItemSearchUiState,
} from '../item-search-view-model';
import { colors, spacing } from '../theme';
import { ItemResultCard } from './ItemResultCard';

type Props = Readonly<{
  state: ItemSearchUiState;
  viewModel: ItemSearchViewModel;
}>;

export function ItemSearchScreen({ state, viewModel }: Props) {
  const hasSearchState = state.status !== 'idle';
  const searchInputRef = useRef<TextInput>(null);
  const dismissSearchInput = useCallback(() => {
    searchInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  useEffect(() => {
    if (hasSearchState) dismissSearchInput();
  }, [dismissSearchInput, hasSearchState]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!hasSearchState) return false;
        dismissSearchInput();
        viewModel.clearSearch();
        return true;
      });

      return () => subscription.remove();
    }, [dismissSearchInput, hasSearchState, viewModel]),
  );

  function submitSearch() {
    dismissSearchInput();
    void viewModel.search();
  }

  function clearSearch() {
    dismissSearchInput();
    viewModel.clearSearch();
  }

  function openDetail(itemId: string) {
    dismissSearchInput();
    viewModel.openDetail(itemId);
  }

  const isSearchDisabled = state.query.trim().length === 0 || state.status === 'loading';

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            품목 검색
          </Text>
          <Text style={styles.description}>버릴 품목의 배출 방법을 확인하세요.</Text>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            accessibilityLabel="품목 검색 창"
            autoCorrect={false}
            enterKeyHint="search"
            onChangeText={(query) => viewModel.setQuery(query)}
            onSubmitEditing={submitSearch}
            placeholder="예: 페트병, 휴대폰"
            placeholderTextColor={colors.outline}
            returnKeyType="search"
            ref={searchInputRef}
            style={styles.searchInput}
            value={state.query}
          />
          <Pressable
            accessibilityLabel="검색"
            accessibilityRole="button"
            disabled={isSearchDisabled}
            onPress={submitSearch}
            style={({ pressed }) => [
              styles.searchButton,
              isSearchDisabled && styles.searchButtonDisabled,
              pressed && !isSearchDisabled && styles.pressed,
            ]}
          >
            <Text style={styles.searchButtonLabel}>검색</Text>
          </Pressable>
        </View>

        {hasSearchState ? (
          <View style={styles.resultHeader}>
            <Text accessibilityLiveRegion="polite" style={styles.resultSummary}>
              {state.status === 'results'
                ? `‘${state.submittedQuery}’ 검색 결과 ${state.results.length}개`
                : `‘${state.submittedQuery}’ 검색 결과`}
            </Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={clearSearch}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.cancelLabel}>취소</Text>
            </Pressable>
          </View>
        ) : null}

        {state.status === 'idle' ? (
          <View style={styles.statusPanel}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text style={styles.recycleSymbol}>♻</Text>
            </View>
            <Text accessibilityRole="header" style={styles.statusTitle}>
              무엇을 버리시나요?
            </Text>
            <Text style={styles.statusDescription}>
              품목명을 검색하면 배출 방법, 특징, 유의사항을 확인할 수 있어요.
            </Text>
          </View>
        ) : null}

        {state.status === 'loading' ? (
          <View accessibilityLiveRegion="polite" style={styles.statusPanel}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.statusTitle}>검색하고 있어요.</Text>
          </View>
        ) : null}

        {state.status === 'empty' ? (
          <View accessibilityLiveRegion="polite" style={styles.statusPanel}>
            <Text accessibilityRole="header" style={styles.statusTitle}>
              검색 결과가 없어요.
            </Text>
            <Text style={styles.statusDescription}>다른 이름으로 다시 검색해보세요.</Text>
          </View>
        ) : null}

        {state.status === 'error' ? (
          <View accessibilityLiveRegion="assertive" style={styles.statusPanel}>
            <Text accessibilityRole="header" style={styles.statusTitle}>
              검색 결과를 불러오지 못했어요.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void viewModel.retry()}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              <Text style={styles.retryLabel}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}

        {state.status === 'results' ? (
          <FlatList
            contentContainerStyle={styles.resultList}
            data={state.results}
            ItemSeparatorComponent={() => <View style={styles.resultGap} />}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ItemResultCard item={item} onPress={() => openDetail(item.id)} />
            )}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.xs },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: '800' },
  description: { color: colors.onSurfaceVariant, fontSize: 16, lineHeight: 24 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
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
  searchButton: {
    minWidth: 64,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  searchButtonDisabled: { opacity: 0.4 },
  searchButtonLabel: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  pressed: { transform: [{ scale: 0.96 }] },
  resultHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  resultSummary: { flex: 1, color: colors.onSurface, fontSize: 17, fontWeight: '700' },
  cancelButton: {
    minWidth: 48,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  statusPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  recycleSymbol: { color: colors.primary, fontSize: 56 },
  statusTitle: { color: colors.onSurface, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  statusDescription: {
    maxWidth: 320,
    color: colors.onSurfaceVariant,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  retryLabel: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  resultList: { padding: spacing.md, paddingBottom: spacing.xl },
  resultGap: { height: spacing.sm },
});
