import { useState, type ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadItemGuide } from '../data/itemCatalog';
import { ItemIcon, ItemStatus, ItemText } from './ItemComponents';
import { getItemDisplay } from './itemDisplay';
import { useItemPreferences } from './ItemPreferencesContext';
import { itemFonts, useItemColors } from './itemTheme';

export function ItemFavoritesScreen({ onGuideSelected, onSearch, header }: {
  header?: ReactElement;
  onGuideSelected: (id: string) => void; onSearch?: () => void;
}) {
  const { data, status, store, pending } = useItemPreferences();
  const colors = useItemColors();
  const [tab, setTab] = useState('품목');
  const guides = data.favorites.flatMap(favorite => {
    const guide = loadItemGuide(favorite.id);
    return guide ? [guide] : [];
  });
  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <FlatList data={tab === '품목' && status === 'ready' ? guides : []} keyExtractor={guide => guide.id}
      contentContainerStyle={styles.list} ListHeaderComponent={header ?? <View style={{ gap: 16 }}>
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>즐겨찾기</Text>
      <View style={[styles.tabs, { borderColor: colors.outline }]}>
      {['품목', '장소', '지역'].map(label => <Pressable key={label} accessibilityRole="tab"
        accessibilityLabel={label} accessibilityState={{ selected: tab === label }} onPress={() => setTab(label)}
        style={styles.tab}>
        <Text style={[styles.tabLabel, { color: colors.primary }]}>{label}</Text>
        {tab === label && <View style={[styles.tabIndicator, { backgroundColor: colors.primary }]} />}
      </Pressable>)}
      </View>
      </View>}
      ListEmptyComponent={tab === '품목' && status === 'loading' ? <ItemStatus loading title="즐겨찾기를 불러오는 중입니다" />
        : tab === '품목' && status === 'error' ? <ItemStatus title="즐겨찾기를 불러오지 못했어요"
          description="잠시 후 다시 시도해 주세요." onRetry={() => { void store.load(); }} />
          : <View style={[styles.empty, { borderColor: colors.outline }]}>
            <ItemIcon name="favorite" color={colors.tertiary} />
            <ItemText accessibilityRole="header" style={[styles.emptyTitle, { color: colors.text }]}>
              {tab === '품목' ? '아직 즐겨찾기한 품목이 없어요' : tab === '장소' ? '즐겨찾기한 수거 장소가 없어요' : '아직 즐겨찾기한 지역 가이드가 없어요'}
            </ItemText>
            {tab === '품목' && <Text style={[styles.description, { color: colors.muted }]}>품목 가이드 상세 화면에서 별을 누르면 여기에 모아볼 수 있어요.</Text>}
            {tab === '장소' && <Text style={[styles.description, { color: colors.muted }]}>지도에서 자주 확인하는 수거 장소를 즐겨찾기에 추가해 보세요.</Text>}
            {tab === '품목' && onSearch && <Pressable accessibilityRole="button" onPress={onSearch}
              style={[styles.searchAction, { backgroundColor: colors.primary }]}>
              <Text style={[styles.tabLabel, { color: colors.onPrimary }]}>품목 검색</Text>
            </Pressable>}
          </View>}
      renderItem={({ item: guide }) => <View style={[styles.card, { borderColor: colors.outline }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${guide.name} 상세 보기`} onPress={() => onGuideSelected(guide.id)}
          style={styles.content}>
          <ItemText numberOfLines={1} style={[styles.title, { color: colors.text }]}>{guide.name}</ItemText>
          <Text numberOfLines={1} style={[styles.metadata, { color: colors.onSecondaryContainer,
            backgroundColor: colors.secondaryContainer }]}>{getItemDisplay(guide).categoryLabel}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${guide.name} 즐겨찾기 해제`}
          disabled={pending.includes(guide.id)} accessibilityState={{ disabled: pending.includes(guide.id) }}
          style={styles.remove} onPress={() => { void store.removeFavorite(guide.id); }}>
          <ItemIcon name="favorite_filled" color={colors.tertiary} size={20} />
        </Pressable>
      </View>} />
  </SafeAreaView>;
}

export function ItemPreferenceFeedback() {
  const { writeError, store } = useItemPreferences();
  const colors = useItemColors();
  if (!writeError) return null;
  return <View accessibilityRole="alert" style={[styles.error, { backgroundColor: colors.errorContainer }]}>
    <Text style={[styles.errorText, { color: colors.onErrorContainer }]}>변경사항을 저장하지 못했어요. 다시 시도해 주세요.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="알림 닫기" onPress={store.dismissWriteError} style={styles.remove}>
      <Text style={[styles.tabLabel, { color: colors.onErrorContainer }]}>닫기</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  heading: { fontFamily: itemFonts.bold, fontSize: 24, lineHeight: 32 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  tabIndicator: { position: 'absolute', bottom: 0, width: 24, height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  tabLabel: { fontFamily: itemFonts.semibold, fontSize: 14 },
  list: { padding: 20, gap: 16, paddingBottom: 24 },
  card: { flexDirection: 'row', borderWidth: 1, borderRadius: 20, alignItems: 'center', paddingRight: 20 },
  content: { flex: 1, gap: 8, padding: 20, minHeight: 72 },
  title: { fontFamily: itemFonts.bold, fontSize: 18, lineHeight: 24 },
  emptyTitle: { fontFamily: itemFonts.semibold, fontSize: 16, lineHeight: 24 },
  metadata: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, fontFamily: itemFonts.medium, fontSize: 14, lineHeight: 20 },
  empty: { borderWidth: 1, borderRadius: 20, padding: 20, gap: 8 },
  description: { fontFamily: itemFonts.regular, fontSize: 14, lineHeight: 20 },
  searchAction: { alignSelf: 'flex-start', minHeight: 48, paddingHorizontal: 24, justifyContent: 'center', borderRadius: 24 },
  remove: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  error: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { flex: 1, fontFamily: itemFonts.medium, fontSize: 14, lineHeight: 20 },
});
