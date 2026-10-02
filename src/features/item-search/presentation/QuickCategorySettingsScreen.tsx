import { useCallback, useEffect, useState } from 'react';
import { BackHandler, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadItemGuide } from '../data/itemCatalog';
import { filterHomeCategories } from '../domain/homeCategories';
import { ItemIcon, ItemStatus, ItemText, ItemTopBar } from './ItemComponents';
import { useItemPreferences } from './ItemPreferencesContext';
import { getItemDisplay } from './itemDisplay';
import { categoryColors, itemFonts, useItemColors } from './itemTheme';

export function QuickCategorySettingsScreen({ maximum, onBack, focused = true }: {
  maximum: number; onBack: () => void; focused?: boolean;
}) {
  const colors = useItemColors();
  const { data, store, status, pending } = useItemPreferences();
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const limit = Number.isFinite(maximum) ? Math.max(0, Math.min(19, Math.floor(maximum))) : 0;
  const back = useCallback(() => { if (query.trim()) setQuery(''); else onBack(); }, [query, onBack]);
  useEffect(() => {
    if (status === 'ready') void store.limitCategories(limit);
  }, [status, store, limit]);
  useEffect(() => {
    if (!focused) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => listener.remove();
  }, [back, focused]);
  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <ItemTopBar title="분리배출 분류 편집" onBack={back} />
    <FlatList data={filterHomeCategories(query)} keyExtractor={category => category.id}
      keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}
      ListHeaderComponent={<View style={{ gap: 16, marginBottom: 16 }}>
        <Text style={[styles.body, { color: colors.muted }]}>홈에 표시할 분리배출 분류를 선택하세요.</Text>
        <View style={[styles.input, { borderColor: colors.fieldOutline }]}>
          <TextInput accessibilityLabel="분류 검색" placeholder="분류 검색" value={query} onChangeText={setQuery} multiline={false}
            placeholderTextColor={colors.muted} style={[styles.searchText, { color: colors.text }]} />
          <ItemIcon name="action_search" color={colors.primary} />
        </View>
        <Text accessibilityLiveRegion="polite" style={[styles.summary, { color: colors.onSecondaryContainer, backgroundColor: colors.secondaryContainer }]}>
          {`홈에 표시할 분류 ${Math.min(data.categories.length, limit)}/${limit}개 선택됨`}
        </Text>
        {status === 'loading' && <ItemStatus loading title="분류 설정을 불러오는 중입니다" />}
        {status === 'error' && <ItemStatus title="분류 설정을 불러오지 못했어요" onRetry={() => { void store.load(); }} />}
        {!!message && <Text accessibilityRole="alert" style={[styles.body, { color: colors.muted }]}>{message}</Text>}
      </View>}
      ListEmptyComponent={<ItemStatus title="검색 결과가 없어요." description="다른 분류 이름으로 다시 검색해 주세요." />}
      renderItem={({ item: category }) => {
        const selected = data.categories.slice(0, limit).includes(category.id);
        const busy = pending.includes(`category:${category.id}`);
        const display = getItemDisplay(loadItemGuide(category.guideId)!);
        const tint = categoryColors(display.category, colors);
        return <Pressable accessibilityRole="checkbox" accessibilityLabel={category.label}
          accessibilityState={{ checked: selected, disabled: busy || status !== 'ready' }} disabled={busy || status !== 'ready'}
          onPress={() => {
            if (!selected && data.categories.length >= limit) {
              setMessage(`최대 ${limit}개까지만 선택할 수 있어요.`);
              return;
            }
            setMessage('');
            void store.toggleCategory(category.id, limit);
          }} style={[styles.row, { backgroundColor: selected ? colors.secondaryContainer : colors.background, borderColor: colors.outline }]}>
          <View style={[styles.icon, { backgroundColor: tint.backgroundColor }]}>
            <ItemIcon name={`disposal_category_${display.category}`} color={tint.color} />
          </View>
          <ItemText style={[styles.label, { color: colors.text }]}>{category.label}</ItemText>
          <View style={[styles.check, { borderColor: selected ? colors.primary : colors.outline, backgroundColor: selected ? colors.primary : colors.background }]}>
            {selected && <ItemIcon name="selection_check" color={colors.onPrimary} size={20} />}
          </View>
        </Pressable>;
      }} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 24, paddingBottom: 32, gap: 8 },
  body: { fontFamily: itemFonts.regular, fontSize: 14, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: 28, minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchText: { flex: 1, minHeight: 54, fontFamily: itemFonts.regular, fontSize: 16 },
  summary: { fontFamily: itemFonts.bold, fontSize: 14, lineHeight: 20, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 28 },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 16, padding: 8 },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontFamily: itemFonts.medium, fontSize: 16, lineHeight: 24 },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
