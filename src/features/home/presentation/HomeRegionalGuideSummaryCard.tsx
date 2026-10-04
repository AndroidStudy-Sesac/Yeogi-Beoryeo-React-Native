import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ItemIcon, ItemText } from '../../item-search/presentation/ItemComponents';
import {
  itemFonts,
  useItemColors,
} from '../../item-search/presentation/itemTheme';
import { formatRegionSelection } from '../../regional-guide/domain/Region';
import type { HomeRegionalGuideSummaryState } from '../../regional-guide/presentation/useHomeRegionalGuideSummary';

export function HomeRegionalGuideSummaryCard({
  state,
  onOpenDetail,
  onOpenRegionalGuide,
  onOpenSaved,
  onRetry,
  onRetryFavorites,
}: Readonly<{
  state: HomeRegionalGuideSummaryState;
  onOpenDetail(): void;
  onOpenRegionalGuide(): void;
  onOpenSaved(): void;
  onRetry(): void;
  onRetryFavorites(): void;
}>) {
  const colors = useItemColors();

  if (state.status === 'ready') {
    return (
      <Pressable
        accessibilityLabel={`${state.summary.regionName} 지역 가이드 상세 보기`}
        accessibilityRole="button"
        onPress={onOpenDetail}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.tertiaryContainer },
          pressed && styles.pressed,
        ]}
      >
        <CardHeader
          loading={state.isRefreshing}
          showChevron
          textColor={colors.onPrimaryContainer}
        />
        <ItemText
          numberOfLines={2}
          style={[styles.title, { color: colors.onPrimaryContainer }]}
        >
          {state.summary.regionName}
        </ItemText>
        <View style={styles.infoRow}>
          <SummaryInfoBlock
            label="배출 요일"
            notice={
              state.summary.hasDifferentDisposalDays ? '품목별 다름' : undefined
            }
            value={state.summary.disposalDays ?? '상세 확인'}
          />
          <SummaryInfoBlock
            label="배출 시간"
            notice={
              state.summary.hasDifferentDisposalTime ? '품목별 다름' : undefined
            }
            value={state.summary.disposalTime ?? '상세 확인'}
          />
        </View>
        {state.summary.hasDifferentDisposalDays ||
        state.summary.hasDifferentDisposalTime ? (
          <ItemText style={[styles.detail, { color: colors.onPrimaryContainer }]}>
            {'일반쓰레기 기준입니다.\n상세 안내에서 확인해 주세요.'}
          </ItemText>
        ) : null}
        {state.isPartial ? (
          <Text style={[styles.notice, { color: colors.onPrimaryContainer }]}>
            일부 조회 결과를 표시하고 있습니다.
          </Text>
        ) : null}
        {state.refreshError ? (
          <View style={styles.refreshError}>
            <Text style={[styles.notice, { color: colors.onPrimaryContainer }]}>
              최신 정보를 불러오지 못해 이전 결과를 표시합니다.
            </Text>
            <Pressable
              accessibilityLabel="배출 정보 다시 불러오기"
              accessibilityRole="button"
              hitSlop={8}
              onPress={event => {
                event.stopPropagation();
                onRetry();
              }}
            >
              <Text style={[styles.retryText, { color: colors.primary }]}>
                다시 시도
              </Text>
            </Pressable>
          </View>
        ) : null}
      </Pressable>
    );
  }

  const content = stateContent(state);
  const action =
    state.status === 'no-favorite'
      ? onOpenRegionalGuide
      : state.status === 'no-representative'
        ? onOpenSaved
        : state.status === 'favorites-failure'
          ? onRetryFavorites
          : state.status === 'failure' ||
              state.status === 'not-found' ||
              state.status === 'not-provided'
            ? onRetry
            : undefined;

  return (
    <Pressable
      accessibilityLabel={content.accessibilityLabel}
      accessibilityRole={action ? 'button' : undefined}
      disabled={!action}
      onPress={action}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.tertiaryContainer },
        pressed && styles.pressed,
      ]}
    >
      <CardHeader
        loading={state.status === 'loading'}
        showChevron={Boolean(action)}
        textColor={colors.onPrimaryContainer}
      />
      <ItemText
        numberOfLines={2}
        style={[styles.title, { color: colors.onPrimaryContainer }]}
      >
        {content.title}
      </ItemText>
      {content.description ? (
        <ItemText
          numberOfLines={3}
          style={[styles.description, { color: colors.onPrimaryContainer }]}
        >
          {content.description}
        </ItemText>
      ) : null}
      {content.detail ? (
        <ItemText style={[styles.detail, { color: colors.onPrimaryContainer }]}>
          {content.detail}
        </ItemText>
      ) : null}
    </Pressable>
  );
}

function CardHeader({
  loading = false,
  showChevron = false,
  textColor,
}: Readonly<{
  loading?: boolean;
  showChevron?: boolean;
  textColor: string;
}>) {
  return (
    <View style={styles.header}>
      <Text style={[styles.label, { color: textColor }]}>지역별 배출 가이드</Text>
      {loading ? <ActivityIndicator color={textColor} size="small" /> : null}
      {!loading && showChevron ? (
        <ItemIcon name="action_chevron_right" color={textColor} size={20} />
      ) : null}
    </View>
  );
}

function SummaryInfoBlock({
  label,
  notice,
  value,
}: Readonly<{ label: string; notice?: string; value: string }>) {
  const colors = useItemColors();
  return (
    <View
      style={[
        styles.infoBlock,
        { backgroundColor: `${colors.background}94` },
      ]}
    >
      <Text style={[styles.infoLabel, { color: colors.primary }]}>{label}</Text>
      <ItemText
        numberOfLines={2}
        style={[styles.infoValue, { color: colors.text }]}
      >
        {value}
      </ItemText>
      {notice ? (
        <Text style={[styles.infoNotice, { color: colors.primary }]}>{notice}</Text>
      ) : null}
    </View>
  );
}

function stateContent(
  state: Exclude<HomeRegionalGuideSummaryState, { status: 'ready' }>,
): Readonly<{
  accessibilityLabel: string;
  title: string;
  description?: string;
  detail?: string;
}> {
  if (state.status === 'loading') {
    return {
      accessibilityLabel: '홈 대표 지역 배출 안내 조회 중',
      title: state.regionName ?? '지역별 배출 가이드',
      description: '고정한 지역의 배출 기준을 불러오는 중입니다.',
    };
  }
  if (state.status === 'favorites-failure') {
    return {
      accessibilityLabel: '홈 지역 가이드 저장 데이터 불러오기 실패',
      title: '지역별 배출 가이드',
      description: '저장된 지역 정보를 불러오지 못했어요.',
      detail: '눌러서 다시 시도해 주세요.',
    };
  }
  if (state.status === 'no-favorite') {
    return {
      accessibilityLabel: '홈 지역 가이드 Favorite 없음',
      title: '지역별 배출 가이드',
      description:
        '지역 가이드를 즐겨찾기하면 배출 기준을 여기에서 확인할 수 있어요.',
    };
  }
  if (state.status === 'no-representative') {
    return {
      accessibilityLabel: '홈 대표 지역 없음',
      title: '대표 지역을 고정해 주세요',
      description:
        '저장 탭의 지역 목록에서 홈에 표시할 지역을 핀으로 고정해 주세요.',
    };
  }

  const regionName = formatRegionSelection(state.favorite.selection);
  if (state.status === 'not-found') {
    return {
      accessibilityLabel: '홈 대표 지역 배출 안내 결과 없음',
      title: regionName,
      description: '최신 배출 안내 결과가 없습니다.',
      detail: '눌러서 다시 시도해 주세요.',
    };
  }
  if (state.status === 'not-provided') {
    return {
      accessibilityLabel: '홈 대표 지역 배출 안내 미제공',
      title: regionName,
      description: '이 지역의 상세 안내가 제공되지 않습니다.',
      detail: '눌러서 다시 시도해 주세요.',
    };
  }
  return {
    accessibilityLabel: '홈 대표 지역 배출 안내 조회 실패',
    title: regionName,
    description: '최신 배출 정보를 불러오지 못했어요.',
    detail: '눌러서 다시 시도해 주세요.',
  };
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, gap: 14, padding: 16 },
  pressed: { opacity: 0.72 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 20,
  },
  label: { fontFamily: itemFonts.bold, fontSize: 12, lineHeight: 16 },
  title: { fontFamily: itemFonts.bold, fontSize: 16, lineHeight: 24 },
  description: { fontFamily: itemFonts.regular, fontSize: 14, lineHeight: 20 },
  detail: { fontFamily: itemFonts.regular, fontSize: 14, lineHeight: 20 },
  infoRow: { flexDirection: 'row', gap: 10 },
  infoBlock: {
    borderRadius: 12,
    flex: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoLabel: { fontFamily: itemFonts.bold, fontSize: 12, lineHeight: 16 },
  infoValue: { fontFamily: itemFonts.semibold, fontSize: 14, lineHeight: 20 },
  infoNotice: { fontFamily: itemFonts.semibold, fontSize: 12, lineHeight: 16 },
  notice: {
    flex: 1,
    fontFamily: itemFonts.medium,
    fontSize: 12,
    lineHeight: 18,
  },
  refreshError: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  retryText: { fontFamily: itemFonts.bold, fontSize: 12, lineHeight: 18 },
});
