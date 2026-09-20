import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ItemIcon, ItemMetadata, ItemSection, ItemStatus, ItemText, ItemTopBar } from './ItemComponents';
import { getItemDisplay } from './itemDisplay';
import { categoryColors, itemFonts, useItemColors, usesLargeItemTypography } from './itemTheme';
import { useItemGuide, type LoadItemGuide } from './useItemGuide';

export function ItemGuideDetailScreen({ guideId, onBack, loadGuide, savedScrollOffset = 0, onScrollOffsetChange }: {
  guideId: string;
  onBack: () => void;
  loadGuide?: LoadItemGuide;
  savedScrollOffset?: number;
  onScrollOffsetChange?: (offset: number) => void;
}) {
  const detail = useItemGuide(guideId, loadGuide);
  const colors = useItemColors();
  const { fontScale } = useWindowDimensions();
  const display = detail.guide ? getItemDisplay(detail.guide) : null;
  const scroll = useRef<ScrollView>(null);
  const positionedGuide = useRef<string | null>(null);
  const pendingPosition = useRef<{ guideId: string; offset: number } | null>(null);

  const restorePosition = useCallback(() => {
    if (detail.status !== 'success' || positionedGuide.current === guideId) return;
    if (pendingPosition.current?.guideId !== guideId) pendingPosition.current = { guideId, offset: savedScrollOffset };
    const offset = pendingPosition.current.offset;
    scroll.current?.scrollTo({ y: offset, animated: false });
    if (offset === 0) {
      positionedGuide.current = guideId;
      pendingPosition.current = null;
    }
  }, [detail.status, guideId, savedScrollOffset]);

  useEffect(() => {
    const frame = requestAnimationFrame(restorePosition);
    return () => cancelAnimationFrame(frame);
  }, [restorePosition]);

  function rememberPosition(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const offset = event.nativeEvent.contentOffset.y;
    const pending = pendingPosition.current;
    if (pending?.guideId === guideId && Math.abs(offset - pending.offset) < 1) {
      positionedGuide.current = guideId;
      pendingPosition.current = null;
    }
    if (positionedGuide.current === guideId && Number.isFinite(offset) && offset >= 0) onScrollOffsetChange?.(offset);
  }

  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']}
    style={[styles.screen, { backgroundColor: colors.background }]}>
    <ItemTopBar onBack={onBack} />
    {detail.status === 'loading' && <ItemStatus loading title="품목 정보를 불러오는 중입니다" />}
    {detail.status === 'not-found' && <ItemStatus title="품목 가이드를 찾을 수 없습니다"
      description="다시 검색해서 품목을 선택해 주세요." />}
    {detail.status === 'error' && <ItemStatus title="품목 정보를 불러오지 못했어요"
      description="잠시 후 다시 시도해 주세요." onRetry={detail.retry} />}
    {detail.guide && display && <ScrollView ref={scroll} contentContainerStyle={styles.content}
      scrollEventThrottle={64} onScroll={rememberPosition}
      onMomentumScrollEnd={rememberPosition} onScrollEndDrag={rememberPosition}
      onScrollBeginDrag={() => {
        positionedGuide.current = guideId;
        pendingPosition.current = null;
      }} onLayout={restorePosition} onContentSizeChange={restorePosition}>
      <View style={styles.heading}>
        <View style={[styles.categoryIcon, { backgroundColor: categoryColors(display.category, colors).backgroundColor }]}>
          <ItemIcon name={`disposal_category_${display.category}`} size={40}
            color={categoryColors(display.category, colors).color} />
        </View>
        <View style={styles.headingText}>
          <ItemText accessibilityRole="header" style={[styles.title, { color: colors.text }, usesLargeItemTypography(fontScale) && styles.largeTitle]}>
            {detail.guide.name}
          </ItemText>
          <ItemMetadata guide={detail.guide} />
        </View>
      </View>
      {display.sections.map(section => <ItemSection key={section.title} {...section} />)}
      <ItemSection title="지역별 배출 기준 안내" lines={[
        '배출방법은 지역별로 차이가 있을 수 있으니, 해당 지방자치단체에서 정하는 방법이 있는 경우에는 해당 방법에 따라 배출하시기 바랍니다.',
      ]} />
    </ScrollView>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  categoryIcon: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  headingText: { flex: 1, gap: 12 },
  title: { fontFamily: itemFonts.extraBold, fontSize: 28, lineHeight: 36 },
  largeTitle: { fontSize: 32, lineHeight: 40 },
});
