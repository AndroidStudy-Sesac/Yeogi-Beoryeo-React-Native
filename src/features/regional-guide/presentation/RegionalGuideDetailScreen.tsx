import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RegionalGuideApiClient } from '../data/regionalGuideApi';
import { getRegionCatalog } from '../data/regionRepository';
import { formatRegionSelection, type RegionSelection } from '../domain/Region';
import type {
  RegionalDisposalGuide,
  RegionalGuideFailureReason,
  RegionalGuidePartialResultMetadata,
  RegionalGuidePartialResultReason,
  RegionalWasteSchedule,
  RegionalWasteType,
} from '../domain/RegionalDisposalGuide';
import { createRegionalGuideQuery } from '../domain/regionalGuideQuery';
import type { RegionalGuideCandidateReason } from '../domain/selectRegionalGuideCandidate';
import {
  presentRegionalGuideCandidates,
  regionalGuideCandidateDisplayMode,
  type RegionalGuideCandidatePresentation,
} from './regionalGuideCandidatePresentation';
import {
  useRegionalGuideDetail,
  type RegionalGuideDetailState,
} from './useRegionalGuideDetail';

const REGIONAL_GUIDE_PUBLIC_NOTICE_URL =
  'https://wasteguide.or.kr/front/support/bannerCollection.do';

type RegionalGuideDetailScreenProps = Readonly<{
  selection: RegionSelection;
  apiClient?: RegionalGuideApiClient;
  onBack?: () => void;
  onCandidateBackHandlerChange?: (handler?: () => boolean) => void;
  onOpenPublicNotice?: () => void;
}>;

export function RegionalGuideDetailScreen({
  selection,
  apiClient,
  onBack,
  onCandidateBackHandlerChange,
  onOpenPublicNotice,
}: RegionalGuideDetailScreenProps) {
  const query = useMemo(() => {
    const regionId = selection.eupmyeondong?.id;
    const aliases = regionId
      ? getRegionCatalog().searchAliasesByRegionId.get(regionId)
      : undefined;
    return createRegionalGuideQuery(selection, aliases);
  }, [selection]);
  const {
    state,
    lookup,
    retry,
    selectCandidate,
    restoreCandidates,
    canRestoreCandidates,
  } = useRegionalGuideDetail(apiClient);
  const { height, width } = useWindowDimensions();
  const isCompactLandscape = width > height && height <= 480;
  const regionPath = formatRegionSelection(selection);
  const openPublicNotice =
    onOpenPublicNotice ??
    (() => {
      void Linking.openURL(REGIONAL_GUIDE_PUBLIC_NOTICE_URL);
    });

  useEffect(() => {
    if (query) void lookup(query);
  }, [lookup, query]);

  useEffect(() => {
    const handler = canRestoreCandidates ? restoreCandidates : undefined;
    onCandidateBackHandlerChange?.(handler);
    return () => onCandidateBackHandlerChange?.(undefined);
  }, [
    canRestoreCandidates,
    onCandidateBackHandlerChange,
    restoreCandidates,
  ]);

  const showsCollectionTypePanel =
    state.status === 'candidates' &&
    regionalGuideCandidateDisplayMode(state.guides, state.reason) ===
      'collection-type';

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          isCompactLandscape && styles.compactLandscapeContent,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {!isCompactLandscape ? (
          <>
            <Text accessibilityRole="header" style={styles.screenTitle}>
              지역별 배출 가이드
            </Text>
            <Text style={styles.screenDescription}>
              지역명을 입력하면 생활쓰레기, 음식물쓰레기, 재활용품 배출 정보를
              확인할 수 있어요.
            </Text>
          </>
        ) : null}

        <Pressable
          accessibilityLabel={`지역 검색어: ${regionPath}. 지역 선택으로 돌아가기`}
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [
            styles.searchField,
            isCompactLandscape && styles.compactLandscapeSearchField,
            pressed && styles.pressed,
          ]}
        >
          <Text numberOfLines={1} style={styles.searchText}>
            {regionPath}
          </Text>
          <View style={styles.searchButton}>
            <SearchIcon />
          </View>
        </Pressable>

        {!showsCollectionTypePanel ? (
          <View
            accessibilityLabel={`선택 지역: ${regionPath}`}
            style={[
              styles.compactRegionCard,
              isCompactLandscape && styles.compactLandscapeRegionCard,
            ]}
          >
            <Text numberOfLines={2} style={styles.compactRegionText}>
              {regionPath}
            </Text>
            <Pressable
              accessibilityLabel="지역 변경"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onBack}
              style={({ pressed }) => [
                styles.changeButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.changeButtonText}>변경</Text>
            </Pressable>
          </View>
        ) : null}

        <DetailContent
          canLookup={Boolean(query)}
          onChangeRegion={onBack}
          onOpenPublicNotice={openPublicNotice}
          onRetry={() => void retry()}
          onSelectCandidate={selectCandidate}
          selection={selection}
          state={state}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailContent({
  canLookup,
  onChangeRegion,
  onOpenPublicNotice,
  onRetry,
  onSelectCandidate,
  selection,
  state,
}: Readonly<{
  canLookup: boolean;
  onChangeRegion?: () => void;
  onOpenPublicNotice(): void;
  onRetry(): void;
  onSelectCandidate(guide: RegionalDisposalGuide): void;
  selection: RegionSelection;
  state: RegionalGuideDetailState;
}>) {
  const regionPath = formatRegionSelection(selection);
  const [candidateListOffset, setCandidateListOffset] = useState(0);

  if (!canLookup) {
    return (
      <View style={styles.detailContent}>
        <MessageCard
          actionLabel={onChangeRegion ? '지역 다시 선택하기' : undefined}
          description="시도와 시군구를 선택한 뒤 조회해 주세요."
          label="지역 가이드 조회 조건 없음"
          onAction={onChangeRegion}
          title="지역을 선택해 주세요."
        />
      </View>
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
        <Text style={styles.bodyText}>
          &quot;{regionPath}&quot; 배출 가이드를 불러오는 중입니다.
        </Text>
      </View>
    );
  }
  if (state.status === 'not-found') {
    return (
      <View style={styles.detailContent}>
        <MessageCard
          actionLabel={onChangeRegion ? '지역 다시 선택하기' : undefined}
          description={
            '공공데이터에 해당 지역 안내가 없거나 지자체 기준이 변경되었을 수 있어요.\n다른 지역을 선택해 다시 확인해 주세요.'
          }
          label="배출 안내 결과 없음"
          onAction={onChangeRegion}
          title="해당 지역의 배출 가이드를 찾지 못했어요."
        />
        <PublicNoticeCta onPress={onOpenPublicNotice} />
      </View>
    );
  }
  if (state.status === 'not-provided') {
    return (
      <View style={styles.detailContent}>
        <MessageCard
          actionLabel={onChangeRegion ? '지역 다시 선택하기' : undefined}
          description={
            '공공데이터에서 해당 읍면동 기준 안내를 제공하지 않아요.\n제공되는 권역을 선택해 다시 확인해 주세요.'
          }
          label="선택 지역 배출 안내 미제공"
          onAction={onChangeRegion}
          title="선택한 읍면동 기준 안내를 찾지 못했어요."
        />
        <PublicNoticeCta onPress={onOpenPublicNotice} />
      </View>
    );
  }
  if (state.status === 'failure') {
    return (
      <View style={styles.detailContent}>
        <MessageCard
          actionLabel="다시 시도"
          description={failureDescription(state.reason)}
          label={`배출 안내 조회 실패: ${failureLabel(state.reason)}`}
          onAction={onRetry}
          title="오류가 발생했습니다"
          tone="error"
        />
      </View>
    );
  }
  if (state.status === 'candidates') {
    const candidates = presentRegionalGuideCandidates(state.guides, selection);
    const displayMode = regionalGuideCandidateDisplayMode(
      state.guides,
      state.reason,
    );
    return (
      <View
        accessibilityLabel="적용 가능한 배출 안내 후보"
        accessibilityLiveRegion="polite"
        style={styles.detailContent}
      >
        {state.partialMetadata ? (
          <PartialNotice metadata={state.partialMetadata} onRetry={onRetry} />
        ) : null}
        {displayMode === 'collection-type' ? (
          <CollectionTypeCandidatePanel
            candidates={candidates}
            onSelectCandidate={onSelectCandidate}
            reason={state.reason}
            regionPath={regionPath}
            selection={selection}
          />
        ) : (
          <GuideCandidateList
            candidates={candidates}
            initialScrollOffset={candidateListOffset}
            onScrollOffsetChange={setCandidateListOffset}
            onSelectCandidate={onSelectCandidate}
          />
        )}
      </View>
    );
  }

  const guide = state.guides[0];
  return (
    <View
      accessibilityLabel={
        state.status === 'partial'
          ? '배출 안내 부분 조회 성공'
          : '배출 안내 조회 성공'
      }
      accessibilityLiveRegion="polite"
      style={styles.detailContent}
    >
      {state.status === 'partial' ? (
        <PartialNotice metadata={state.metadata} onRetry={onRetry} />
      ) : null}
      {guide ? (
        <GuideContent
          guide={guide}
          onOpenPublicNotice={onOpenPublicNotice}
          selection={selection}
        />
      ) : (
        <MessageCard
          description="표시된 페이지에서는 선택 지역의 안내를 확인하지 못했습니다. 다시 조회해 주세요."
          label="부분 결과 내 선택 지역 안내 없음"
          title="선택 지역 안내를 아직 확인하지 못했어요."
        />
      )}
    </View>
  );
}

function GuideContent({
  guide,
  onOpenPublicNotice,
  selection,
}: Readonly<{
  guide: RegionalDisposalGuide;
  onOpenPublicNotice(): void;
  selection: RegionSelection;
}>) {
  const scheduleGroups = groupSchedules(guide.schedules);

  return (
    <>
      <SummaryCard guide={guide} selection={selection} />
      <PublicNoticeCta onPress={onOpenPublicNotice} />
      <Text style={styles.scheduleSectionTitle}>배출 요일 및 시간</Text>
      {scheduleGroups.map(group => (
        <ScheduleCard group={group} key={group.key} />
      ))}
    </>
  );
}

function SummaryCard({
  guide,
  selection,
}: Readonly<{
  guide: RegionalDisposalGuide;
  selection: RegionSelection;
}>) {
  const displayRegionName = [
    guide.sidoName ?? selection.sido?.name,
    guide.sigunguName ?? selection.sigungu?.name,
    selection.eupmyeondong?.name,
  ]
    .filter((part): part is string => Boolean(displayValue(part)))
    .join(' ');
  const contact = [guide.departmentName, guide.departmentPhoneNumber]
    .filter((part): part is string => Boolean(displayValue(part)))
    .join(' ');

  return (
    <View
      accessibilityLabel={`배출 안내: ${displayRegionName || '지역 정보'}`}
      style={styles.summaryCard}
    >
      <Text style={styles.summaryTitle}>
        {displayRegionName || '지역 정보'}
      </Text>
      <InfoRow label="관리구역" value={displayValue(guide.managementZoneName)} />
      <InfoRow label="대상지역" value={displayValue(guide.targetRegionName)} />
      <InfoRow label="배출장소" value={displayValue(guide.disposalPlaceType)} />
      <InfoRow label="장소설명" value={displayValue(guide.disposalPlace)} />
      <InfoRow label="미수거일" value={displayValue(guide.uncollectedDays)} />
      <InfoRow label="문의" value={displayValue(contact)} />
    </View>
  );
}

function CollectionTypeCandidatePanel({
  candidates,
  onSelectCandidate,
  reason,
  regionPath,
  selection,
}: Readonly<{
  candidates: readonly RegionalGuideCandidatePresentation[];
  onSelectCandidate(guide: RegionalDisposalGuide): void;
  reason: RegionalGuideCandidateReason;
  regionPath: string;
  selection: RegionSelection;
}>) {
  const optionTexts = candidates.map(candidate => candidate.collectionTypeLabel);
  const duplicatedOptions = new Set(
    optionTexts.filter((text, index) => optionTexts.indexOf(text) !== index),
  );
  const message = candidateMessage(reason, selection);

  return (
    <View style={styles.candidatePanel}>
      <View style={styles.candidateIntro}>
        <Text style={styles.candidatePanelTitle}>{message.title}</Text>
        <Text style={styles.bodyText}>{message.description}</Text>
      </View>
      <View>
        <Text style={styles.infoLabel}>선택한 지역</Text>
        <Text style={styles.candidateSelectedRegion}>{regionPath}</Text>
      </View>
      <View style={styles.candidateDivider} />
      <View style={styles.candidateList}>
        <Text style={styles.candidateSectionTitle}>수거 유형 선택</Text>
        {candidates.map((candidate, index) => {
          const { guide } = candidate;
          const optionText = candidate.collectionTypeLabel;
          return (
            <Pressable
              accessibilityLabel={`배출 안내 후보 ${index + 1}: ${optionText}${candidate.collectionTypeSupportingText ? `, ${candidate.collectionTypeSupportingText}` : ''}`}
              accessibilityRole="button"
              key={candidate.key}
              onPress={() => onSelectCandidate(guide)}
              style={({ pressed }) => [
                styles.candidateCard,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.candidateTextGroup}>
                <Text style={styles.candidateOptionTitle}>{optionText}</Text>
                {candidate.collectionTypeSupportingText ? (
                  <Text style={styles.candidateSupportingText}>
                    {candidate.collectionTypeSupportingText}
                  </Text>
                ) : null}
                {duplicatedOptions.has(optionText) &&
                candidate.distinguishingText ? (
                  <Text style={styles.candidateSupportingText}>
                    {candidate.distinguishingText}
                  </Text>
                ) : null}
              </View>
              <View style={styles.selectBadge}>
                <Text style={styles.selectBadgeText}>선택</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function GuideCandidateList({
  candidates,
  initialScrollOffset,
  onScrollOffsetChange,
  onSelectCandidate,
}: Readonly<{
  candidates: readonly RegionalGuideCandidatePresentation[];
  initialScrollOffset: number;
  onScrollOffsetChange(offset: number): void;
  onSelectCandidate(guide: RegionalDisposalGuide): void;
}>) {
  const scrollRef = useRef<ScrollView>(null);
  const initialScrollOffsetRef = useRef(initialScrollOffset);

  useEffect(() => {
    const offset = initialScrollOffsetRef.current;
    if (offset <= 0) return;
    scrollRef.current?.scrollTo({ animated: false, y: offset });
  }, []);

  return (
    <ScrollView
      accessibilityLabel={`배출 안내 후보 목록, ${candidates.length}개`}
      nestedScrollEnabled
      onScroll={({ nativeEvent }) =>
        onScrollOffsetChange(nativeEvent.contentOffset.y)
      }
      ref={scrollRef}
      scrollEventThrottle={16}
      style={styles.guideCandidateList}
    >
      {candidates.map((candidate, index) => (
        <Pressable
          accessibilityLabel={`배출 안내 후보 ${index + 1}: ${candidate.label}`}
          accessibilityRole="button"
          key={candidate.key}
          onPress={() => onSelectCandidate(candidate.guide)}
          style={({ pressed }) => [
            styles.guideCandidateRow,
            index > 0 && styles.guideCandidateRowDivider,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.guideCandidateRowText}>{candidate.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function PartialNotice({
  metadata,
  onRetry,
}: Readonly<{
  metadata: RegionalGuidePartialResultMetadata;
  onRetry(): void;
}>) {
  return (
    <View style={styles.partialCard}>
      <Text style={styles.partialTitle}>일부 안내만 불러왔어요.</Text>
      <Text style={styles.bodyText}>
        표시된 내용은 확인할 수 있지만 전체 결과가 아닐 수 있습니다.
      </Text>
      <Text style={styles.bodyText}>
        중단 사유: {partialReasonLabel(metadata.reason)}
      </Text>
      <TextAction
        accessibilityLabel="전체 배출 안내 다시 조회"
        label="다시 시도"
        onPress={onRetry}
      />
    </View>
  );
}

type ScheduleGroup = Readonly<{
  key: string;
  schedule: RegionalWasteSchedule;
  disposalPlaces: readonly string[];
}>;

function ScheduleCard({ group }: Readonly<{ group: ScheduleGroup }>) {
  const [isExpanded, setExpanded] = useState(false);
  const { schedule, disposalPlaces } = group;
  const wasteTypeName = wasteTypeLabel(schedule.wasteType);

  return (
    <View
      accessibilityLabel={`${wasteTypeName} 배출 안내`}
      style={styles.scheduleCard}
    >
      <Text style={styles.scheduleTitle}>{wasteTypeName}</Text>
      <InfoRow label="요일" value={displayValue(schedule.disposalDays)} />
      <InfoRow label="시간" value={formatScheduleTime(schedule)} />
      <InfoRow label="방법" value={displayValue(schedule.disposalMethod)} />
      {disposalPlaces.length === 1 ? (
        <InfoRow label="장소" value={disposalPlaces[0]} />
      ) : null}
      {disposalPlaces.length > 1 ? (
        <>
          <InfoRow label="장소" value={`${disposalPlaces.length}곳`} />
          <TextAction
            accessibilityLabel={`${wasteTypeName} 배출장소 ${isExpanded ? '접기' : '펼치기'}`}
            label={isExpanded ? '접기' : '자세히 보기'}
            onPress={() => setExpanded(current => !current)}
          />
          {isExpanded ? (
            <View style={styles.placeList}>
              {disposalPlaces.map(place => (
                <Text key={place} style={styles.bodyText}>
                  - {place}
                </Text>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
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
  tone = 'default',
}: Readonly<{
  actionLabel?: string;
  description: string;
  label: string;
  onAction?: () => void;
  title: string;
  tone?: 'default' | 'error';
}>) {
  const isError = tone === 'error';
  return (
    <View
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={[styles.messageCard, isError && styles.errorCard]}
    >
      <Text style={[styles.messageTitle, isError && styles.errorText]}>
        {title}
      </Text>
      <Text style={[styles.bodyText, isError && styles.errorText]}>
        {description}
      </Text>
      {actionLabel && onAction ? (
        <TextAction label={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  );
}

function TextAction({
  accessibilityLabel,
  label,
  onPress,
}: Readonly<{
  accessibilityLabel?: string;
  label: string;
  onPress(): void;
}>) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.textAction,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.textActionLabel}>{label}</Text>
    </Pressable>
  );
}

function PublicNoticeCta({ onPress }: Readonly<{ onPress(): void }>) {
  return (
    <Pressable
      accessibilityLabel="공공 안내에서 지자체 안내 링크 보기, 외부 공공 안내 페이지로 이동"
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [
        styles.publicNoticeButton,
        pressed && styles.pressed,
      ]}
    >
      <SearchIcon />
      <Text style={styles.publicNoticeText}>
        공공 안내에서 지자체 안내 링크 보기
      </Text>
      <Text accessibilityElementsHidden style={styles.chevron}>
        ›
      </Text>
    </Pressable>
  );
}

function SearchIcon() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.searchIcon}
    >
      <View style={styles.searchIconCircle} />
      <View style={styles.searchIconHandle} />
    </View>
  );
}

function groupSchedules(
  schedules: readonly RegionalWasteSchedule[],
): readonly ScheduleGroup[] {
  const groups = new Map<
    string,
    { schedule: RegionalWasteSchedule; disposalPlaces: string[] }
  >();

  for (const schedule of schedules) {
    const key = scheduleDisplayKey(schedule);
    const existing = groups.get(key) ?? { schedule, disposalPlaces: [] };
    const disposalPlace = displayValue(schedule.disposalPlace);
    if (disposalPlace && !existing.disposalPlaces.includes(disposalPlace)) {
      existing.disposalPlaces.push(disposalPlace);
    }
    groups.set(key, existing);
  }

  return [...groups.entries()].map(([key, group]) => ({ key, ...group }));
}

function scheduleDisplayKey(schedule: RegionalWasteSchedule): string {
  return [
    schedule.wasteType,
    schedule.disposalDays,
    schedule.disposalStartTime,
    schedule.disposalEndTime,
    schedule.disposalMethod,
  ].join('|');
}

function displayValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (
    !normalized ||
    normalized.toLowerCase() === 'null' ||
    ['-', '없음', '해당없음'].includes(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function wasteTypeLabel(wasteType: RegionalWasteType): string {
  if (wasteType === 'general') return '일반쓰레기';
  if (wasteType === 'food') return '음식물쓰레기';
  return '재활용품';
}

function formatScheduleTime(
  schedule: RegionalWasteSchedule,
): string | undefined {
  if (schedule.disposalStartTime && schedule.disposalEndTime) {
    return `${schedule.disposalStartTime} ~ ${schedule.disposalEndTime}`;
  }
  if (schedule.disposalStartTime) return `${schedule.disposalStartTime} 이후`;
  if (schedule.disposalEndTime) return `${schedule.disposalEndTime} 이전`;
  return undefined;
}

function candidateMessage(
  reason: RegionalGuideCandidateReason,
  selection: RegionSelection,
): Readonly<{ title: string; description: string }> {
  const eupmyeondong = displayValue(selection.eupmyeondong?.name);
  const sigungu = displayValue(selection.sigungu?.name);
  if (reason === 'fallback-because-direct-match-not-found') {
    return {
      title: '직접 안내를 찾지 못했어요',
      description:
        eupmyeondong && sigungu
          ? `${eupmyeondong}의 직접 배출 안내가 없어 ${sigungu} 기준 수거 유형을 선택해 주세요.`
          : '선택한 지역의 직접 배출 안내가 없어 같은 시군구 기준 수거 유형을 선택해 주세요.',
    };
  }
  return {
    title: '수거 유형을 선택해 주세요',
    description: sigungu
      ? `${sigungu} 기준 수거 유형을 선택하면 안내를 확인할 수 있어요.`
      : '수거 유형을 선택하면 안내를 확인할 수 있어요.',
  };
}

function failureLabel(reason: RegionalGuideFailureReason): string {
  if (reason === 'timeout') return '시간 초과';
  if (reason === 'network') return '네트워크 오류';
  if (reason === 'api') return 'API 오류';
  if (reason === 'configuration') return 'API 설정 오류';
  return '알 수 없는 오류';
}

function failureDescription(reason: RegionalGuideFailureReason): string {
  if (reason === 'network') {
    return '네트워크 연결을 확인한 뒤 다시 시도해주세요.';
  }
  if (reason === 'configuration') {
    return '지역별 배출 가이드 API 연결 설정을 확인한 뒤 다시 시도해주세요.';
  }
  if (reason === 'timeout') {
    return '지역별 배출 가이드 조회 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
  }
  if (reason === 'api') {
    return '지역별 배출 가이드 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
  }
  return '선택한 지역의 배출 가이드를 조회하는 중 오류가 발생했습니다.';
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
  errorContainer: '#FFDAD6',
  onErrorContainer: '#7A0000',
  onSurface: '#1A1C19',
  onSurfaceVariant: '#424940',
  outlineVariant: '#DDE5DD',
  primary: '#2E7D32',
  primaryContainer: '#C8E6C9',
  surface: '#FFFFFF',
  tertiaryContainer: '#FFECB3',
  onTertiaryContainer: '#4E3400',
} as const;

const styles = StyleSheet.create({
  safeArea: { backgroundColor: COLORS.background, flex: 1 },
  content: { paddingBottom: 40, paddingHorizontal: 20, paddingTop: 20 },
  compactLandscapeContent: { paddingHorizontal: 16, paddingTop: 12 },
  screenTitle: { color: COLORS.primary, fontSize: 24, fontWeight: '700' },
  screenDescription: {
    color: COLORS.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  searchField: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.primary,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 20,
    minHeight: 56,
  },
  compactLandscapeSearchField: { marginTop: 0 },
  searchText: {
    color: COLORS.onSurface,
    flex: 1,
    fontSize: 16,
    paddingLeft: 16,
  },
  searchButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  searchIcon: { height: 24, position: 'relative', width: 24 },
  searchIconCircle: {
    borderColor: COLORS.primary,
    borderRadius: 8,
    borderWidth: 2,
    height: 15,
    left: 2,
    position: 'absolute',
    top: 2,
    width: 15,
  },
  searchIconHandle: {
    backgroundColor: COLORS.primary,
    borderRadius: 1,
    height: 2,
    left: 14,
    position: 'absolute',
    top: 15,
    transform: [{ rotate: '45deg' }],
    width: 8,
  },
  compactRegionCard: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.outlineVariant,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    minHeight: 64,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  compactLandscapeRegionCard: { marginTop: 12 },
  compactRegionText: {
    color: COLORS.onSurface,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  changeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  changeButtonText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  detailContent: { gap: 12, marginTop: 20 },
  loading: { alignItems: 'center', gap: 16, paddingVertical: 40 },
  bodyText: {
    color: COLORS.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 20,
  },
  messageCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.outlineVariant,
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    padding: 24,
  },
  messageTitle: { color: COLORS.onSurface, fontSize: 16, fontWeight: '700' },
  errorCard: { backgroundColor: COLORS.errorContainer, gap: 12 },
  errorText: { color: COLORS.onErrorContainer },
  textAction: {
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  textActionLabel: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  partialCard: {
    backgroundColor: COLORS.tertiaryContainer,
    borderRadius: 20,
    gap: 8,
    padding: 20,
  },
  partialTitle: {
    color: COLORS.onTertiaryContainer,
    fontSize: 16,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.outlineVariant,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 24,
  },
  summaryTitle: { color: COLORS.onSurface, fontSize: 22, fontWeight: '700' },
  infoRow: { gap: 2 },
  infoLabel: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },
  infoValue: {
    color: COLORS.onSurfaceVariant,
    fontSize: 15,
    lineHeight: 22,
  },
  publicNoticeButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 24,
  },
  publicNoticeText: {
    color: COLORS.primary,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  chevron: { color: COLORS.primary, fontSize: 28, lineHeight: 30 },
  scheduleSectionTitle: {
    color: COLORS.onSurface,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  scheduleCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.outlineVariant,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 20,
  },
  scheduleTitle: { color: COLORS.onSurface, fontSize: 16, fontWeight: '700' },
  placeList: { gap: 4 },
  candidatePanel: {
    backgroundColor: 'rgba(46, 125, 50, 0.12)',
    borderColor: 'rgba(46, 125, 50, 0.22)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  candidateIntro: { gap: 5 },
  candidatePanelTitle: { color: COLORS.primary, fontSize: 16, fontWeight: '700' },
  candidateSelectedRegion: {
    color: COLORS.onSurface,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  candidateDivider: { backgroundColor: 'rgba(46, 125, 50, 0.12)', height: 1 },
  candidateList: { gap: 10 },
  candidateSectionTitle: { color: COLORS.primary, fontSize: 16, fontWeight: '700' },
  candidateCard: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: 'rgba(46, 125, 50, 0.24)',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  candidateTextGroup: { flex: 1, gap: 4 },
  candidateOptionTitle: { color: COLORS.onSurface, fontSize: 16, fontWeight: '700' },
  candidateSupportingText: {
    color: COLORS.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 16,
  },
  selectBadge: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectBadgeText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  guideCandidateList: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.outlineVariant,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 260,
    overflow: 'hidden',
  },
  guideCandidateRow: {
    backgroundColor: '#FAFAF7',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  guideCandidateRowDivider: { borderTopColor: COLORS.outlineVariant, borderTopWidth: 1 },
  guideCandidateRowText: {
    color: COLORS.onSurface,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  pressed: { opacity: 0.72 },
});
