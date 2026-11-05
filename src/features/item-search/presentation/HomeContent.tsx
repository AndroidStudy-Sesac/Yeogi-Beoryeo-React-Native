import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { loadItemGuide } from '../data/itemCatalog';
import { orderedHomeCategories } from '../domain/homeCategories';
import { ItemIcon, ItemStatus, ItemText } from './ItemComponents';
import { useItemPreferences } from './ItemPreferencesContext';
import { getItemDisplay } from './itemDisplay';
import { categoryColors, itemFonts, useItemColors } from './itemTheme';
import { homeCollapsedCount, homeGridMetrics, type ItemHomeSnapshot } from './homeLayout';
import { usefulGuides, type UsefulGuideType } from './usefulGuides';

export function HomeContent({ searchField, homeSummaryCard, onGuideSelected, onUsefulGuide, onCategorySettings, savedState, onSnapshot, focused = true }: {
  focused?: boolean;
  savedState?: ItemHomeSnapshot;
  onSnapshot?: (snapshot: ItemHomeSnapshot) => void;
  searchField: ReactNode;
  homeSummaryCard?: ReactNode;
  onGuideSelected: (id: string) => void;
  onUsefulGuide: (type: UsefulGuideType) => void;
  onCategorySettings: (maximum: number) => void;
}) {
  const colors = useItemColors();
  const preferences = useItemPreferences();
  const { width, height, fontScale } = useWindowDimensions();
  const padding = width <= 384 ? 16 : 24;
  const metrics = homeGridMetrics(width - padding * 2, fontScale);
  const [viewport, setViewport] = useState(0);
  const [gridTop, setGridTop] = useState(0);
  const [sectionHeadingHeight, setSectionHeadingHeight] = useState(40);
  const [expanded, setExpanded] = useState(savedState?.expanded ?? false);
  const [fixedCount, setFixedCount] = useState(savedState?.collapsedCount ?? 0);
  const [page, setPage] = useState(savedState?.guidePage ?? 0);
  const scroll = useRef<ScrollView>(null);
  const carousel = useRef<ScrollView>(null);
  const offset = useRef(savedState?.scrollOffset ?? 0);
  const collapsedOffset = useRef(savedState?.collapsedScrollOffset ?? 0);
  const snapshot = useRef<ItemHomeSnapshot>(savedState ?? {
    expanded: false, collapsedCount: 0, scrollOffset: 0, collapsedScrollOffset: 0, guidePage: 0,
  });
  const positioned = useRef(!savedState?.scrollOffset);
  const showCollapseAfterSettings = useRef(false);
  const remember = useCallback((change: Partial<ItemHomeSnapshot>) => {
    snapshot.current = { ...snapshot.current, ...change };
    onSnapshot?.(snapshot.current);
  }, [onSnapshot]);
  const measuredCount = homeCollapsedCount(metrics.columns, viewport - gridTop - sectionHeadingHeight - 16, metrics.rowHeight, metrics.gap);
  const count = expanded && fixedCount > 0 && fixedCount % metrics.columns === 0 ? fixedCount : measuredCount;
  const categories = orderedHomeCategories(preferences.data.categories);
  const cardWidth = (width - padding * 2) * (width > height && height <= 480 ? 0.56 : 0.94);
  useEffect(() => {
    if (positioned.current || viewport <= 0) return;
    const frame = requestAnimationFrame(() => scroll.current?.scrollTo({ y: offset.current, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [viewport]);
  useEffect(() => {
    if (!focused || !expanded || !showCollapseAfterSettings.current) return;
    showCollapseAfterSettings.current = false;
    const frame = requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [focused, expanded]);

  return <ScrollView ref={scroll} keyboardShouldPersistTaps="handled"
    onLayout={event => setViewport(event.nativeEvent.layout.height)}
    onContentSizeChange={() => {
      if (!positioned.current && viewport > 0) scroll.current?.scrollTo({ y: offset.current, animated: false });
    }}
    onScrollBeginDrag={() => { positioned.current = true; }}
    onScroll={event => {
      const next = event.nativeEvent.contentOffset.y;
      if (!positioned.current && Math.abs(next - offset.current) < 1) positioned.current = true;
      if (positioned.current && next >= 0) { offset.current = next; remember({ scrollOffset: next }); }
    }} scrollEventThrottle={64}
    contentContainerStyle={{ paddingTop: 12, paddingBottom: 24, gap: 24 }}>
    <View style={{ paddingHorizontal: padding, gap: 8 }}>
      <Text accessibilityRole="header" style={[styles.homeTitle, { color: colors.text }]}>여기 버려</Text>
      <ItemText style={[styles.body, { color: colors.muted }]}>품목 검색, 수거 장소, 지역별 배출 정보를 한 곳에서 확인하세요.</ItemText>
    </View>
    <View style={{ gap: 16 }}>
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text, marginHorizontal: padding }]}>안내 사항</Text>
      <View style={{ gap: 8 }}>
      <ScrollView ref={carousel} horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + 8}
        onLayout={() => carousel.current?.scrollTo({ x: page * (cardWidth + 8), animated: false })}
        decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: padding, gap: 8 }}
        onMomentumScrollEnd={event => {
          const next = Math.min(3, Math.max(0, Math.round(event.nativeEvent.contentOffset.x / (cardWidth + 8))));
          setPage(next); remember({ guidePage: next });
        }}>
        {usefulGuides.map(guide => <Pressable key={guide.type} accessibilityRole="button"
          accessibilityLabel={guide.title} onPress={() => onUsefulGuide(guide.type)}
          style={({ pressed }) => [styles.banner, { width: cardWidth, backgroundColor: colors.secondaryContainer, opacity: pressed ? 0.7 : 1 }]}>
          <View style={[styles.bannerIcon, { backgroundColor: colors.background }]}>
            <ItemIcon name={guide.icon} color={colors.primary} />
          </View>
          <View style={styles.bannerText}>
            <Text style={[styles.label, { color: colors.primary }]}>{guide.label}</Text>
            <ItemText style={[styles.bannerTitle, { color: colors.onSecondaryContainer }]}>{guide.title}</ItemText>
            <ItemText style={[styles.body, { color: colors.onSecondaryContainer }]}>{guide.description}</ItemText>
          </View>
          <ItemIcon name="guide_arrow" size={20} color={colors.onSecondaryContainer} />
        </Pressable>)}
      </ScrollView>
      <View accessible accessibilityLabel={`안내 ${page + 1}/4`} style={styles.indicators}>
        {usefulGuides.map((guide, index) => <View key={guide.type}
          style={{ width: index === page ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: index === page ? colors.primary : colors.outline }} />)}
      </View>
      </View>
    </View>
    {homeSummaryCard ? <View style={{ paddingHorizontal: padding }}>{homeSummaryCard}</View> : null}
    <View style={{ paddingHorizontal: padding }}>{searchField}</View>
    <View style={{ paddingHorizontal: padding, gap: 16 }} onLayout={event => setGridTop(event.nativeEvent.layout.y)}>
      <View style={styles.sectionHeading} onLayout={event => setSectionHeadingHeight(event.nativeEvent.layout.height)}>
        <Text accessibilityRole="header" style={[styles.heading, { color: colors.text, flex: 1 }]}>분리배출 분류</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="표시 항목 관리"
          onPress={() => {
            showCollapseAfterSettings.current = expanded;
            onCategorySettings(Math.max(0, count - 1));
          }} style={[styles.manage, { borderColor: colors.outline }]}>
          <Text style={[styles.body, { color: colors.primary, fontFamily: itemFonts.medium }]}>표시 항목 관리</Text>
          <ItemIcon name="action_chevron_right" size={16} color={colors.text} />
        </Pressable>
      </View>
      {preferences.status === 'loading' && <ItemStatus loading title="분류 설정을 불러오는 중입니다" />}
      {preferences.status === 'error' && <ItemStatus title="분류 설정을 불러오지 못했어요"
        onRetry={() => { void preferences.store.load(); }} />}
      <View style={[styles.grid, { rowGap: metrics.gap }]}>
        {(expanded ? categories : categories.slice(0, Math.max(0, count - 1))).map(category => {
          const guide = loadItemGuide(category.guideId)!;
          const display = getItemDisplay(guide);
          const tint = categoryColors(display.category, colors);
          return <Pressable key={category.id} accessibilityRole="button" accessibilityLabel={`${category.label} 배출 방법 보기`}
            accessibilityHint={preferences.data.categories.includes(category.id) ? '홈 표시 항목으로 선택됨' : undefined}
            onPress={() => onGuideSelected(category.guideId)}
            style={({ pressed }) => [styles.category, { width: `${100 / metrics.columns}%`, minHeight: metrics.rowHeight, opacity: pressed ? 0.65 : 1 }]}>
            <View style={[styles.tile, { width: metrics.tile, height: metrics.tile, backgroundColor: tint.backgroundColor }]}>
              <ItemIcon name={`disposal_category_${display.category}`} color={tint.color} size={metrics.icon} />
              {preferences.data.categories.includes(category.id) && <View style={[styles.selectedBadge, { backgroundColor: colors.primaryContainer, borderColor: colors.primary }]}>
                <ItemIcon name="selection_check" color={colors.primary} size={12} />
              </View>}
            </View>
            <ItemText style={[styles.categoryLabel, { color: colors.text, fontSize: metrics.labelSize, lineHeight: metrics.labelHeight }]}>{category.label}</ItemText>
          </Pressable>;
        })}
        {!expanded && <Pressable accessibilityRole="button" accessibilityLabel="더보기" onPress={() => {
          collapsedOffset.current = offset.current;
          setFixedCount(measuredCount);
          setExpanded(true);
          remember({ expanded: true, collapsedCount: measuredCount, collapsedScrollOffset: offset.current });
        }} style={[styles.category, { width: `${100 / metrics.columns}%`, minHeight: metrics.rowHeight }]}>
          <View style={[styles.tile, { width: metrics.tile, height: metrics.tile, backgroundColor: colors.surfaceVariant }]}>
            <ItemIcon name="more_horiz" color={colors.muted} size={metrics.icon} />
          </View>
          <Text style={[styles.categoryLabel, { color: colors.text, fontSize: metrics.labelSize, lineHeight: metrics.labelHeight }]}>더보기</Text>
        </Pressable>}
      </View>
      {expanded && <Pressable accessibilityRole="button" accessibilityLabel="접기" style={styles.collapse}
        onPress={() => {
          setExpanded(false); remember({ expanded: false, scrollOffset: collapsedOffset.current });
          requestAnimationFrame(() => scroll.current?.scrollTo({ y: collapsedOffset.current, animated: false }));
        }}>
        <Text style={[styles.body, { color: colors.primary }]}>접기</Text>
      </Pressable>}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  homeTitle: { fontFamily: itemFonts.bold, fontSize: 32, lineHeight: 40 },
  heading: { fontFamily: itemFonts.bold, fontSize: 22, lineHeight: 28 },
  banner: { borderRadius: 12, padding: 16, flexDirection: 'row', gap: 8, minHeight: 136, alignItems: 'flex-start' },
  bannerIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  bannerText: { flex: 1, gap: 4 },
  label: { fontFamily: itemFonts.bold, fontSize: 12, lineHeight: 18 },
  bannerTitle: { fontFamily: itemFonts.bold, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: itemFonts.regular, fontSize: 14, lineHeight: 20 },
  indicators: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  manage: { minHeight: 48, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  category: { alignItems: 'center', paddingHorizontal: 4, gap: 4 },
  tile: { borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  categoryLabel: { fontFamily: itemFonts.medium, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  collapse: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  selectedBadge: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, position: 'absolute', right: -4, top: -4, alignItems: 'center', justifyContent: 'center' },
});
