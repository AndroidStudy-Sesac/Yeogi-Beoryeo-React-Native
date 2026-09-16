import { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RegionalGuideApiClient } from '../data/regionalGuideApi';
import { formatRegionSelection, type RegionSelection } from '../domain/Region';
import type {
  RegionalDisposalGuide,
  RegionalGuideFailureReason,
  RegionalGuidePartialResultReason,
  RegionalWasteSchedule,
  RegionalWasteType,
} from '../domain/RegionalDisposalGuide';
import { createRegionalGuideQuery } from '../domain/regionalGuideQuery';
import {
  useRegionalGuideDetail,
  type RegionalGuideDetailState,
} from './useRegionalGuideDetail';

type RegionalGuideDetailScreenProps = Readonly<{
  selection: RegionSelection;
  apiClient?: RegionalGuideApiClient;
  onBack?: () => void;
}>;

export function RegionalGuideDetailScreen({
  selection,
  apiClient,
  onBack,
}: RegionalGuideDetailScreenProps) {
  const query = useMemo(() => createRegionalGuideQuery(selection), [selection]);
  const { state, lookup, retry } = useRegionalGuideDetail(apiClient);

  useEffect(() => {
    if (query) void lookup(query);
  }, [lookup, query]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="지역 선택으로 돌아가기"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          배출 안내 상세
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View
          accessibilityLabel={`선택 지역: ${formatRegionSelection(selection)}`}
          style={styles.regionCard}
        >
          <Text style={styles.regionLabel}>선택 지역</Text>
          <Text style={styles.regionPath}>{formatRegionSelection(selection)}</Text>
        </View>
        <DetailContent
          canLookup={Boolean(query)}
          onRetry={() => void retry()}
          state={state}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailContent({
  canLookup,
  onRetry,
  state,
}: Readonly<{
  canLookup: boolean;
  onRetry(): void;
  state: RegionalGuideDetailState;
}>) {
  if (!canLookup) {
    return (
      <MessageCard
        description="시·군·구를 다시 선택해주세요."
        label="지역 가이드 조회 조건 없음"
        title="조회할 지역이 올바르지 않아요."
      />
    );
  }
  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <View
        accessibilityLabel="배출 안내 조회 중"
        accessibilityLiveRegion="polite"
        style={styles.loading}
      >
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.messageDescription}>배출 안내를 불러오고 있어요.</Text>
      </View>
    );
  }
  if (state.status === 'not-found') {
    return (
      <MessageCard
        description="해당 시·군·구의 공공데이터 조회 결과가 없습니다."
        label="배출 안내 결과 없음"
        title="배출 안내를 찾지 못했어요."
      />
    );
  }
  if (state.status === 'not-provided') {
    return (
      <MessageCard
        description="선택한 읍·면·동은 현재 상세 배출 안내가 제공되지 않습니다."
        label="선택 지역 배출 안내 미제공"
        title="이 지역은 안내가 제공되지 않아요."
      />
    );
  }
  if (state.status === 'failure') {
    return (
      <MessageCard
        actionLabel="다시 조회"
        description={failureDescription(state.reason)}
        label={`배출 안내 조회 실패: ${failureLabel(state.reason)}`}
        onAction={onRetry}
        title={failureTitle(state.reason)}
      />
    );
  }

  return (
    <View
      accessibilityLabel={
        state.status === 'partial'
          ? '배출 안내 부분 조회 성공'
          : '배출 안내 조회 성공'
      }
      accessibilityLiveRegion="polite"
      style={styles.results}
    >
      {state.status === 'partial' ? (
        <View style={styles.partialCard}>
          <Text style={styles.partialTitle}>일부 안내만 불러왔어요.</Text>
          <Text style={styles.messageDescription}>
            표시된 내용은 확인할 수 있지만 전체 결과가 아닐 수 있습니다.
          </Text>
          <Text style={styles.messageDescription}>
            {`중단 사유: ${partialReasonLabel(state.metadata.reason)}`}
          </Text>
          <Pressable
            accessibilityLabel="전체 배출 안내 다시 조회"
            accessibilityRole="button"
            onPress={onRetry}
            style={({ pressed }) => [
              styles.outlineButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.outlineButtonText}>다시 조회</Text>
          </Pressable>
        </View>
      ) : null}

      {state.guides.length > 0 ? (
        state.guides.map((guide, index) => (
          <GuideCard
            guide={guide}
            index={index}
            key={`${guide.managementZoneName ?? ''}:${guide.targetRegionName ?? ''}:${index}`}
          />
        ))
      ) : (
        <MessageCard
          description="받은 페이지에서는 선택 지역의 안내를 확인하지 못했습니다. 다시 조회해주세요."
          label="부분 결과 내 선택 지역 안내 없음"
          title="선택 지역 안내를 아직 확인하지 못했어요."
        />
      )}
    </View>
  );
}

function GuideCard({
  guide,
  index,
}: Readonly<{ guide: RegionalDisposalGuide; index: number }>) {
  const target = guide.targetRegionName ?? guide.managementZoneName;
  return (
    <View
      accessibilityLabel={`배출 안내 ${index + 1}${target ? `: ${target}` : ''}`}
      style={styles.guideCard}
    >
      {target ? <Text style={styles.guideTitle}>{target}</Text> : null}
      <InfoRow label="배출 장소" value={guide.disposalPlace} />
      <InfoRow label="장소 유형" value={guide.disposalPlaceType} />
      <InfoRow label="미수거일" value={guide.uncollectedDays} />

      <View style={styles.scheduleList}>
        {WASTE_TYPES.map(wasteType => (
          <ScheduleCard
            key={wasteType}
            schedule={guide.schedules.find(
              candidate => candidate.wasteType === wasteType,
            )}
            wasteType={wasteType}
          />
        ))}
      </View>

      <InfoRow label="담당 부서" value={guide.departmentName} />
      <InfoRow label="문의" value={guide.departmentPhoneNumber} />
    </View>
  );
}

function ScheduleCard({
  schedule,
  wasteType,
}: Readonly<{
  schedule?: RegionalWasteSchedule;
  wasteType: RegionalWasteType;
}>) {
  return (
    <View
      accessibilityLabel={`${wasteTypeLabel(wasteType)} 배출 안내`}
      style={styles.scheduleCard}
    >
      <Text style={styles.scheduleTitle}>{wasteTypeLabel(wasteType)}</Text>
      {schedule ? (
        <>
          <InfoRow label="요일" value={schedule.disposalDays} />
          <InfoRow label="시간" value={formatScheduleTime(schedule)} />
          <InfoRow label="방법" value={schedule.disposalMethod} />
        </>
      ) : (
        <Text style={styles.emptySchedule}>제공된 안내가 없습니다.</Text>
      )}
    </View>
  );
}

function InfoRow({
  label,
  value,
}: Readonly<{ label: string; value?: string }>) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function MessageCard({
  actionLabel,
  description,
  label,
  onAction,
  title,
}: Readonly<{
  actionLabel?: string;
  description: string;
  label: string;
  onAction?: () => void;
  title: string;
}>) {
  return (
    <View
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={styles.messageCard}
    >
      <Text style={styles.messageTitle}>{title}</Text>
      <Text style={styles.messageDescription}>{description}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [
            styles.outlineButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.outlineButtonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const WASTE_TYPES: readonly RegionalWasteType[] = [
  'general',
  'food',
  'recyclable',
];

function wasteTypeLabel(wasteType: RegionalWasteType): string {
  if (wasteType === 'general') return '생활폐기물';
  if (wasteType === 'food') return '음식물쓰레기';
  return '재활용품';
}

function formatScheduleTime(schedule: RegionalWasteSchedule) {
  if (schedule.disposalStartTime && schedule.disposalEndTime) {
    return `${schedule.disposalStartTime} ~ ${schedule.disposalEndTime}`;
  }
  return schedule.disposalStartTime ?? schedule.disposalEndTime;
}

function failureLabel(reason: RegionalGuideFailureReason): string {
  if (reason === 'timeout') return '시간 초과';
  if (reason === 'network') return '네트워크 오류';
  if (reason === 'api') return 'API 오류';
  if (reason === 'configuration') return 'API 설정 오류';
  return '알 수 없는 오류';
}

function failureTitle(reason: RegionalGuideFailureReason): string {
  if (reason === 'timeout') return '조회 시간이 초과되었어요.';
  if (reason === 'network') return '네트워크 연결을 확인해주세요.';
  if (reason === 'api') return '배출 안내 API 오류가 발생했어요.';
  if (reason === 'configuration') return '배출 안내 서버 설정이 필요해요.';
  return '배출 안내를 불러오지 못했어요.';
}

function failureDescription(reason: RegionalGuideFailureReason): string {
  if (reason === 'network') {
    return '인터넷 연결을 확인한 뒤 다시 조회해주세요.';
  }
  if (reason === 'configuration') {
    return '앱의 지역 가이드 API 주소를 확인해주세요.';
  }
  return '잠시 후 다시 조회해주세요.';
}

function partialReasonLabel(reason: RegionalGuidePartialResultReason): string {
  if (reason === 'timeout') return '시간 초과';
  if (reason === 'network') return '네트워크 오류';
  if (reason === 'api') return 'API 오류';
  if (reason === 'page-limit') return '최대 페이지 도달';
  if (reason === 'inconsistent-response') return '응답 정보 불일치';
  return '알 수 없는 오류';
}

const COLORS = {
  background: '#FFFFFF',
  onSurface: '#1A1C19',
  onSurfaceVariant: '#424940',
  outlineVariant: '#DDE5DD',
  primary: '#2E7D32',
  primaryContainer: '#E7F4E7',
  warningContainer: '#FFF4D6',
  warningText: '#5F4700',
} as const;

const styles = StyleSheet.create({
  safeArea: { backgroundColor: COLORS.background, flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomColor: COLORS.outlineVariant,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: 12,
  },
  backButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  backButtonText: { color: COLORS.onSurface, fontSize: 34, lineHeight: 36 },
  title: { color: COLORS.onSurface, fontSize: 19, fontWeight: '700' },
  content: { gap: 16, padding: 20, paddingBottom: 40 },
  regionCard: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 16,
    gap: 4,
    padding: 18,
  },
  regionLabel: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  regionPath: { color: COLORS.onSurface, fontSize: 17, fontWeight: '700' },
  loading: { alignItems: 'center', gap: 14, paddingVertical: 48 },
  results: { gap: 16 },
  messageCard: {
    borderColor: COLORS.outlineVariant,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 20,
  },
  messageTitle: { color: COLORS.onSurface, fontSize: 17, fontWeight: '700' },
  messageDescription: {
    color: COLORS.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 21,
  },
  partialCard: {
    backgroundColor: COLORS.warningContainer,
    borderRadius: 18,
    gap: 8,
    padding: 20,
  },
  partialTitle: { color: COLORS.warningText, fontSize: 17, fontWeight: '700' },
  outlineButton: {
    alignItems: 'center',
    borderColor: COLORS.primary,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 44,
  },
  outlineButtonText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  guideCard: {
    borderColor: COLORS.outlineVariant,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 20,
  },
  guideTitle: { color: COLORS.onSurface, fontSize: 18, fontWeight: '700' },
  scheduleList: { gap: 10, marginVertical: 6 },
  scheduleCard: {
    backgroundColor: '#FAFAF7',
    borderRadius: 14,
    gap: 7,
    padding: 14,
  },
  scheduleTitle: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  infoRow: { flexDirection: 'row', gap: 10 },
  infoLabel: {
    color: COLORS.onSurfaceVariant,
    fontSize: 13,
    width: 62,
  },
  infoValue: { color: COLORS.onSurface, flex: 1, fontSize: 14, lineHeight: 20 },
  emptySchedule: { color: COLORS.onSurfaceVariant, fontSize: 13 },
  pressed: { opacity: 0.7 },
});
