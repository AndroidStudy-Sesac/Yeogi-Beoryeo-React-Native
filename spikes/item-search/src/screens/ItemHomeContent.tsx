import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  getQuickCategoryGridMetrics,
  orderHomeQuickCategories,
  type HomeQuickCategory,
} from '../item-home';
import { colors, spacing } from '../theme';
import { usefulGuides, type UsefulGuideId } from '../useful-guides';

type Props = Readonly<{
  onLimitSelectedCategories: (maxSelectedCount: number) => Promise<unknown>;
  onOpenCategory: (category: HomeQuickCategory) => void;
  onOpenCategorySettings: () => void;
  onOpenGuide: (guideId: UsefulGuideId) => void;
  selectedCategoryIds: readonly string[];
}>;

export function ItemHomeContent({
  onLimitSelectedCategories,
  onOpenCategory,
  onOpenCategorySettings,
  onOpenGuide,
  selectedCategoryIds,
}: Props) {
  const { height, width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const gridTop = useRef(0);
  const [isExpanded, setExpanded] = useState(false);
  const metrics = getQuickCategoryGridMetrics(width, height);
  const orderedCategories = orderHomeQuickCategories(selectedCategoryIds);
  const categories = isExpanded
    ? orderedCategories
    : orderedCategories.slice(0, metrics.collapsedCategoryCount);
  const itemWidth = (width - spacing.md * 2) / metrics.columnCount;

  useEffect(() => {
    void onLimitSelectedCategories(metrics.collapsedCategoryCount);
  }, [
    metrics.collapsedCategoryCount,
    onLimitSelectedCategories,
    selectedCategoryIds,
  ]);

  function collapseCategories() {
    setExpanded(false);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ animated: true, y: gridTop.current });
    });
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      style={styles.scroll}
    >
      <View style={styles.introCard}>
        <Text accessibilityRole="header" style={styles.introTitle}>
          무엇을 버리시나요?
        </Text>
        <Text style={styles.introDescription}>
          이름으로 검색하거나 대표 분류에서 배출 방법을 확인하세요.
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleGroup}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>빠른 카테고리</Text>
          <Text style={styles.sectionDescription}>대표 품목의 배출 방법을 바로 확인합니다.</Text>
        </View>
        <Pressable
          accessibilityLabel="홈 표시 카테고리 편집"
          accessibilityRole="button"
          onPress={onOpenCategorySettings}
          style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
        >
          <Text style={styles.editLabel}>편집 〉</Text>
        </Pressable>
      </View>

      <View
        onLayout={(event) => {
          gridTop.current = event.nativeEvent.layout.y;
        }}
        style={styles.grid}
      >
        {categories.map((category) => (
          <View key={category.id} style={{ width: itemWidth }}>
            <Pressable
              accessibilityHint="대표 품목 상세를 엽니다."
              accessibilityLabel={category.label}
              accessibilityRole="button"
              onPress={() => onOpenCategory(category)}
              style={({ pressed }) => [
                styles.categoryButton,
                pressed && styles.pressed,
              ]}
            >
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.categorySymbolBox}>
                <Text allowFontScaling={false} style={styles.categorySymbol}>{category.symbol}</Text>
              </View>
              <Text numberOfLines={2} style={styles.categoryLabel}>{category.label}</Text>
            </Pressable>
          </View>
        ))}
        <View style={{ width: itemWidth }}>
          <Pressable
            accessibilityRole="button"
            onPress={isExpanded ? collapseCategories : () => setExpanded(true)}
            style={({ pressed }) => [styles.categoryButton, pressed && styles.pressed]}
          >
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.toggleSymbolBox}>
              <Text allowFontScaling={false} style={styles.toggleSymbol}>{isExpanded ? '⌃' : '•••'}</Text>
            </View>
            <Text style={styles.categoryLabel}>{isExpanded ? '접기' : '더보기'}</Text>
          </Pressable>
        </View>
      </View>

      <Text accessibilityRole="header" style={styles.sectionTitle}>유용한 안내</Text>
      <ScrollView
        contentContainerStyle={styles.guideRow}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {usefulGuides.map((guide) => (
          <Pressable
            accessibilityHint="안내 상세를 엽니다."
            accessibilityRole="button"
            key={guide.id}
            onPress={() => onOpenGuide(guide.id)}
            style={({ pressed }) => [styles.guideCard, pressed && styles.pressed]}
          >
            <Text style={styles.guideLabel}>{guide.label}</Text>
            <Text numberOfLines={2} style={styles.guideTitle}>{guide.title}</Text>
            <Text style={styles.guideAction}>안내 보기 〉</Text>
          </Pressable>
        ))}
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  introCard: {
    borderRadius: 20,
    backgroundColor: colors.secondaryContainer,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  introTitle: { color: colors.onPrimaryContainer, fontSize: 22, fontWeight: '800' },
  introDescription: { color: colors.onSurfaceVariant, fontSize: 16, lineHeight: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  sectionTitleGroup: { flex: 1, gap: spacing.xs },
  sectionTitle: { color: colors.onSurface, fontSize: 20, fontWeight: '800' },
  sectionDescription: { color: colors.onSurfaceVariant, fontSize: 14, lineHeight: 20 },
  editButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  editLabel: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.md },
  categoryButton: {
    minHeight: 108,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  categorySymbolBox: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.primaryContainer,
  },
  categorySymbol: { color: colors.primary, fontSize: 24, fontWeight: '800' },
  toggleSymbolBox: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.surfaceHigh,
  },
  toggleSymbol: { color: colors.onSurfaceVariant, fontSize: 22, fontWeight: '800' },
  categoryLabel: {
    minHeight: 40,
    color: colors.onSurface,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
  guideRow: { gap: spacing.md, paddingRight: spacing.md },
  guideCard: {
    width: 260,
    minHeight: 150,
    borderColor: colors.outlineVariant,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: colors.surfaceLow,
    padding: spacing.md,
    gap: spacing.sm,
  },
  guideLabel: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  guideTitle: { color: colors.onSurface, fontSize: 18, fontWeight: '800', lineHeight: 25 },
  guideAction: { marginTop: 'auto', color: colors.primary, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
