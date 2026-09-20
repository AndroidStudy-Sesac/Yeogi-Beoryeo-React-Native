import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler, FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput,
  useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ItemGuide } from '../domain/itemGuide';
import { ItemIcon, ItemMetadata, ItemStatus, ItemText, ItemTopBar } from './ItemComponents';
import { getItemDisplay, itemReadableText, itemText } from './itemDisplay';
import { itemFonts, useItemColors } from './itemTheme';
import { useItemSearch, type ItemSearchSnapshot, type SearchItems } from './useItemSearch';

export function ItemSearchScreen({
  initialQuery, savedState, onSnapshot, onGuideSelected, focused = true, searchItems,
}: {
  initialQuery?: string;
  savedState?: ItemSearchSnapshot;
  onSnapshot?: (snapshot: ItemSearchSnapshot) => void;
  onGuideSelected: (id: string) => void;
  focused?: boolean;
  searchItems?: SearchItems;
}) {
  const search = useItemSearch({ initialQuery, savedState, onSnapshot, searchItems });
  const colors = useItemColors();
  const { width, height } = useWindowDimensions();
  const horizontalPadding = width <= 384 ? 16 : 24;
  const screenSpace = width > height && height <= 480 ? 16 : width <= 384 ? 20 : 24;
  const list = useRef<FlatList<ItemGuide>>(null);
  const input = useRef<TextInput>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const positionedVersion = useRef<number | null>(null);
  const pendingPosition = useRef<{ version: number; offset: number } | null>(null);
  const hasSearched = search.submittedQuery !== null;
  const hasResults = search.status === 'success';
  const hasSummary = hasResults || search.status === 'empty';
  const borderWidth = inputFocused ? 2 : 1;
  const clearSearch = search.clear;

  const restorePosition = useCallback(() => {
    if (!focused || search.status !== 'success' || positionedVersion.current === search.resultVersion) return;
    if (pendingPosition.current?.version !== search.resultVersion) {
      pendingPosition.current = { version: search.resultVersion, offset: search.scrollOffset };
    }
    const offset = pendingPosition.current.offset;
    list.current?.scrollToOffset({ offset, animated: false });
    if (offset === 0) {
      positionedVersion.current = search.resultVersion;
      pendingPosition.current = null;
    }
  }, [focused, search.resultVersion, search.scrollOffset, search.status]);

  useEffect(() => {
    const frame = requestAnimationFrame(restorePosition);
    return () => cancelAnimationFrame(frame);
  }, [restorePosition]);

  useEffect(() => {
    if (!focused || !hasSearched) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      clearSearch();
      return true;
    });
    return () => subscription.remove();
  }, [focused, hasSearched, clearSearch]);

  function submit() {
    if (!search.query.trim()) return;
    Keyboard.dismiss();
    input.current?.blur();
    search.submit();
  }

  function rememberPosition(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const offset = event.nativeEvent.contentOffset.y;
    const pending = pendingPosition.current;
    if (focused && pending?.version === search.resultVersion && Math.abs(offset - pending.offset) < 1) {
      positionedVersion.current = search.resultVersion;
      pendingPosition.current = null;
    }
    if (positionedVersion.current === search.resultVersion) search.rememberScroll(offset);
  }

  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']}
    style={[styles.screen, { backgroundColor: colors.background }]}>
    <ItemTopBar title={hasSearched ? '품목 검색' : '여기 버려'} onBack={hasSearched ? () => clearSearch() : undefined} />
    <View style={{ paddingHorizontal: horizontalPadding,
      paddingTop: 8 + (hasSearched && !hasResults ? screenSpace : 0),
      gap: hasResults ? 8 : screenSpace, paddingBottom: hasSummary ? 16 : screenSpace }}>
      <View style={[styles.searchField, { backgroundColor: colors.background,
        borderColor: inputFocused ? colors.primary : colors.fieldOutline, borderWidth,
        paddingLeft: 16 - borderWidth }]}>
        <Text pointerEvents="none" accessible={false}
          style={[styles.inputLabel, { color: inputFocused ? colors.primary : colors.muted, backgroundColor: colors.background },
            (inputFocused || !!search.query) && styles.floatingLabel]}>품목 검색 창</Text>
        <TextInput ref={input} accessibilityLabel="품목 검색 창" placeholder={inputFocused ? '무엇을 버리시나요?' : ''}
          placeholderTextColor={colors.muted} value={search.query} onChangeText={search.editQuery}
          onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)}
          onSubmitEditing={submit} returnKeyType="search" autoCorrect={false} autoCapitalize="none"
          style={[styles.input, { color: colors.text, paddingLeft: 0 }]} />
        <Pressable accessibilityRole="button" accessibilityLabel="검색" disabled={!search.query.trim()}
          accessibilityState={{ disabled: !search.query.trim() }} onPress={submit}
          style={[styles.iconButton, { marginRight: -borderWidth }]}>
          <ItemIcon name="action_search" size={width <= 384 ? 24 : 20}
            color={search.query.trim() || inputFocused ? colors.primary : colors.muted} />
        </Pressable>
      </View>
      {(search.status === 'success' || search.status === 'empty') &&
        <Text accessibilityRole="header" accessibilityLiveRegion="polite"
          style={[styles.resultSummary, { color: colors.text }]}>
          {`‘${itemText(search.submittedQuery ?? '')}’ 검색 결과${search.guides.length > 0 ? ` ${search.guides.length}개` : ''}`}
        </Text>}
    </View>
    {search.status === 'loading' && <ItemStatus loading title="검색 결과를 불러오는 중입니다" />}
    {search.status === 'error' && <ItemStatus title="검색 결과를 불러오지 못했어요."
      description="잠시 후 다시 시도해 주세요." onRetry={search.retry} />}
    {search.status === 'empty' && <ItemStatus title="검색 결과가 없어요."
      description="다른 이름으로 다시 검색해보세요." />}
    {search.status === 'success' && <View style={styles.results}>
      <FlatList ref={list} data={search.guides} keyExtractor={guide => guide.id}
        keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingBottom: 24, gap: 12 }}
        onScroll={rememberPosition} scrollEventThrottle={64}
        onMomentumScrollEnd={rememberPosition} onScrollEndDrag={rememberPosition}
        onScrollBeginDrag={() => {
          positionedVersion.current = search.resultVersion;
          pendingPosition.current = null;
        }}
        onLayout={restorePosition}
        onContentSizeChange={restorePosition}
        renderItem={({ item: guide }) => <Pressable accessibilityRole="button"
          accessibilityLabel={itemReadableText(`${guide.name}, ${getItemDisplay(guide).categoryLabel}, 상세 보기`)}
          onPress={() => { Keyboard.dismiss(); onGuideSelected(guide.id); }}
          style={({ pressed }) => [styles.resultCard, { borderColor: colors.outline, opacity: pressed ? 0.65 : 1 }]}>
          <View style={styles.cardContent}>
            <ItemText accessible={false} numberOfLines={2} style={[styles.cardTitle, { color: colors.text }]}>{guide.name}</ItemText>
            <ItemMetadata guide={guide} />
            {getItemDisplay(guide).summary && <ItemText accessible={false} numberOfLines={2} style={[styles.cardDescription, { color: colors.muted }]}>
              {getItemDisplay(guide).summary!}
            </ItemText>}
          </View>
          <ItemIcon name="action_chevron_right" size={20} color={colors.outline} />
        </Pressable>} />
      {search.scrollOffset > 0 && <Pressable accessibilityRole="button" accessibilityLabel="맨 위로 이동"
        onPress={() => list.current?.scrollToOffset({ offset: 0, animated: true })}
        style={[styles.toTop, { backgroundColor: colors.primaryContainer }]}>
        <View style={styles.upIcon}><ItemIcon name="action_chevron_right" color={colors.onPrimaryContainer} /></View>
      </Pressable>}
    </View>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  searchField: { minHeight: 56, borderRadius: 12, flexDirection: 'row', alignItems: 'center', elevation: 6 },
  inputLabel: { position: 'absolute', left: 12, paddingHorizontal: 4, fontFamily: itemFonts.regular, fontSize: 16 },
  floatingLabel: { top: -8, fontSize: 12, lineHeight: 16 },
  input: { flex: 1, fontFamily: itemFonts.regular, fontSize: 16, minHeight: 54, paddingVertical: 12 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  resultSummary: { fontFamily: itemFonts.medium, fontSize: 16, lineHeight: 24 },
  results: { flex: 1 },
  resultCard: { borderWidth: 1, borderRadius: 16, padding: 19, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardContent: { flex: 1, gap: 8 },
  cardTitle: { fontFamily: itemFonts.bold, fontSize: 16, lineHeight: 24 },
  cardDescription: { fontFamily: itemFonts.regular, fontSize: 14, lineHeight: 20 },
  toTop: { position: 'absolute', bottom: 16, right: 16, width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  upIcon: { transform: [{ rotate: '-90deg' }] },
});
