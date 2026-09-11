import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RegionCatalog } from '../data/regionRepository';
import type { RegionSearchService } from '../data/regionSearchService';
import {
  formatRegionSelection,
  type Region,
  type RegionLevel,
  type RegionSelection,
} from '../domain/Region';
import type { RegionSearchCandidate } from '../domain/RegionSearch';
import { useRegionSearch } from './useRegionSearch';
import { useRegionSelection } from './useRegionSelection';

type RegionalGuideScreenProps = Readonly<{
  regionCatalog?: RegionCatalog;
  regionSearchService?: RegionSearchService;
  debounceMilliseconds?: number;
  initialQuery?: string;
  onRegionSelected?: (selection: RegionSelection) => void;
}>;

type DropdownAnchor = Readonly<{
  height: number;
  width: number;
  x: number;
  y: number;
}>;

type RegionSelectorProps = Readonly<{
  accessibilityLabel: string;
  disabledLabel?: string;
  enabled: boolean;
  label: string;
  options: readonly Region[];
  selected?: Region;
  onSelect(region: Region): void;
}>;

export function RegionalGuideScreen({
  regionCatalog,
  regionSearchService,
  debounceMilliseconds,
  initialQuery,
  onRegionSelected,
}: RegionalGuideScreenProps) {
  const search = useRegionSearch({
    service: regionSearchService,
    debounceMilliseconds,
    initialQuery,
  });
  const selection = useRegionSelection(regionCatalog);
  const selectPath = selection.selectPath;
  const [candidateHistory, setCandidateHistory] = useState<
    readonly RegionSearchCandidate[]
  >([]);

  useEffect(() => {
    if (search.state.status !== 'resolved') return;
    selectPath(search.state.candidate.region);
    onRegionSelected?.(search.state.candidate.region);
  }, [onRegionSelected, search.state, selectPath]);

  const selectManualRegion = (level: RegionLevel, region: Region) => {
    selection.selectRegion(level, region);
  };

  const selectSearchCandidate = (candidate: RegionSearchCandidate) => {
    if (search.state.status === 'candidates') {
      setCandidateHistory(search.state.candidates);
    }
    search.selectCandidate(candidate);
  };

  const selectedPath = formatRegionSelection(selection.selection);
  const canConfirmSelection = Boolean(selection.selection.sigungu);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text accessibilityRole="header" style={styles.title}>
          지역별 배출 가이드
        </Text>
        <Text style={styles.description}>
          지역명을 입력하면 생활쓰레기, 음식물쓰레기, 재활용품 배출 정보를
          확인할 수 있어요.
        </Text>

        <RegionSearchField
          onChangeText={value => {
            setCandidateHistory([]);
            search.setQuery(value);
          }}
          onSearch={() => void search.search()}
          onSelectCandidate={selectSearchCandidate}
          query={search.query}
          state={search.state}
        />

        <View style={styles.selectorCard}>
          <View style={styles.selectorRow}>
            <RegionSelector
              accessibilityLabel="시·도"
              enabled
              label="시도 선택"
              onSelect={region => selectManualRegion('sido', region)}
              options={selection.sidoRegions}
              selected={selection.selection.sido}
            />
            <RegionSelector
              accessibilityLabel="시·군·구"
              enabled={Boolean(selection.selection.sido)}
              label="시군구 선택"
              onSelect={region => selectManualRegion('sigungu', region)}
              options={selection.sigunguRegions}
              selected={selection.selection.sigungu}
            />
          </View>
          <RegionSelector
            accessibilityLabel="읍·면·동"
            disabledLabel={
              selection.selection.sigungu &&
              selection.eupmyeondongRegions.length === 0
                ? '제공되는 읍면동 없음'
                : undefined
            }
            enabled={
              Boolean(selection.selection.sigungu) &&
              selection.eupmyeondongRegions.length > 0
            }
            label="읍면동 선택"
            onSelect={region => selectManualRegion('eupmyeondong', region)}
            options={selection.eupmyeondongRegions}
            selected={selection.selection.eupmyeondong}
          />

          {selectedPath ? (
            <View accessibilityLabel="선택한 지역" style={styles.selectedPath}>
              <Text style={styles.selectedPathText}>{selectedPath}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityLabel="선택한 지역 조회"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canConfirmSelection }}
            disabled={!canConfirmSelection}
            onPress={() => onRegionSelected?.(selection.selection)}
            style={({ pressed }) => [
              styles.lookupButton,
              !canConfirmSelection && styles.lookupButtonDisabled,
              pressed && canConfirmSelection && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.lookupButtonText,
                !canConfirmSelection && styles.lookupButtonTextDisabled,
              ]}
            >
              조회
            </Text>
          </Pressable>
        </View>

        <SearchStatus
          candidateHistory={candidateHistory}
          onRestoreCandidates={() => search.restoreCandidates(candidateHistory)}
          onRetry={() => void search.search()}
          state={search.state}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

type RegionSearchFieldProps = Readonly<{
  onChangeText(value: string): void;
  onSearch(): void;
  onSelectCandidate(candidate: RegionSearchCandidate): void;
  query: string;
  state: ReturnType<typeof useRegionSearch>['state'];
}>;

function RegionSearchField({
  onChangeText,
  onSearch,
  onSelectCandidate,
  query,
  state,
}: RegionSearchFieldProps) {
  const [isFocused, setFocused] = useState(false);
  const hasCandidates = state.status === 'candidates';
  const isSearchEnabled = Boolean(query.trim());

  return (
    <View style={styles.searchContainer}>
      <View
        style={[
          styles.searchField,
          (isFocused || isSearchEnabled) && styles.searchFieldActive,
          hasCandidates && styles.searchFieldWithCandidates,
        ]}
      >
        <TextInput
          accessibilityLabel="지역명 또는 주소 검색"
          autoCapitalize="none"
          autoCorrect={false}
          onBlur={() => setFocused(false)}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onSubmitEditing={onSearch}
          placeholder="지역명 또는 주소를 검색해주세요."
          placeholderTextColor={COLORS.onSurfaceVariant}
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />
        <Pressable
          accessibilityLabel="지역 검색"
          accessibilityRole="button"
          accessibilityState={{ disabled: !isSearchEnabled }}
          disabled={!isSearchEnabled}
          hitSlop={4}
          onPress={onSearch}
          style={({ pressed }) => [
            styles.searchButton,
            pressed && isSearchEnabled && styles.pressed,
          ]}
        >
          <SearchIcon active={isFocused || isSearchEnabled} />
        </Pressable>
      </View>
      {hasCandidates ? (
        <View
          accessibilityLabel={`지역 검색 후보 목록, ${state.candidates.length}개`}
          style={styles.candidatePanel}
        >
          <ScrollView nestedScrollEnabled style={styles.candidateScrollView}>
            {state.candidates.map((candidate, index) => (
              <Pressable
                accessibilityLabel={`지역 후보: ${candidate.displayName}`}
                accessibilityRole="button"
                key={candidate.id}
                onPress={() => onSelectCandidate(candidate)}
                style={({ pressed }) => [
                  styles.candidateRow,
                  index > 0 && styles.candidateDivider,
                  pressed && styles.candidatePressed,
                ]}
              >
                <Text numberOfLines={1} style={styles.candidateText}>
                  {formatRegionSelection(candidate.region)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function SearchIcon({ active }: Readonly<{ active: boolean }>) {
  const color = active ? COLORS.primary : COLORS.onSurfaceVariant;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.searchIconCircle, { borderColor: color }]} />
      <View style={[styles.searchIconHandle, { backgroundColor: color }]} />
    </View>
  );
}

function RegionSelector({
  accessibilityLabel,
  disabledLabel,
  enabled,
  label,
  options,
  selected,
  onSelect,
}: RegionSelectorProps) {
  const triggerRef = useRef<View>(null);
  const { height: windowHeight } = useWindowDimensions();
  const [anchor, setAnchor] = useState<DropdownAnchor>();
  const isOpen = anchor !== undefined;
  const displayedLabel =
    selected?.name ??
    (!enabled && options.length === 0 && disabledLabel ? disabledLabel : label);

  const open = () => {
    setAnchor({ height: 44, width: 160, x: 20, y: 120 });
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ height, width, x, y });
    });
  };

  return (
    <View style={styles.selectorContainer}>
      <Pressable
        accessibilityLabel={`${accessibilityLabel} 선택`}
        accessibilityRole="button"
        accessibilityState={{ disabled: !enabled, expanded: isOpen }}
        disabled={!enabled}
        onPress={open}
        ref={triggerRef}
        style={({ pressed }) => [
          styles.selector,
          selected && styles.selectorSelected,
          !enabled && styles.selectorDisabled,
          pressed && enabled && styles.pressed,
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.selectorText,
            !enabled && styles.selectorTextDisabled,
          ]}
        >
          {displayedLabel}
        </Text>
        <Text style={styles.selectorArrow}>⌄</Text>
      </Pressable>
      <Modal
        animationType="none"
        onRequestClose={() => setAnchor(undefined)}
        statusBarTranslucent
        transparent
        visible={isOpen}
      >
        <View style={styles.dropdownOverlay}>
          <Pressable
            accessibilityLabel={`${accessibilityLabel} 선택 닫기`}
            accessibilityRole="button"
            onPress={() => setAnchor(undefined)}
            style={StyleSheet.absoluteFill}
          />
          {anchor ? (
            <View
              style={[
                styles.dropdownMenu,
                {
                  left: anchor.x,
                  top: Math.max(
                    8,
                    Math.min(anchor.y + anchor.height + 4, windowHeight - 288),
                  ),
                  width: anchor.width,
                },
              ]}
            >
              <ScrollView
                accessibilityLabel={`${accessibilityLabel} 옵션 목록`}
                nestedScrollEnabled
              >
                {options.map(option => (
                  <Pressable
                    accessibilityLabel={`${accessibilityLabel} 옵션: ${option.name}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: option.id === selected?.id }}
                    key={option.id}
                    onPress={() => {
                      onSelect(option);
                      setAnchor(undefined);
                    }}
                    style={({ pressed }) => [
                      styles.dropdownOption,
                      option.id === selected?.id && styles.dropdownOptionSelected,
                      pressed && styles.candidatePressed,
                    ]}
                  >
                    <Text numberOfLines={1} style={styles.dropdownOptionText}>
                      {option.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

type SearchStatusProps = Readonly<{
  state: ReturnType<typeof useRegionSearch>['state'];
  candidateHistory: readonly RegionSearchCandidate[];
  onRetry(): void;
  onRestoreCandidates(): void;
}>;

function SearchStatus({
  state,
  candidateHistory,
  onRetry,
  onRestoreCandidates,
}: SearchStatusProps) {
  if (
    state.status === 'empty' ||
    state.status === 'idle' ||
    state.status === 'candidates'
  ) {
    return null;
  }
  if (state.status === 'searching') {
    return (
      <View accessibilityLabel="지역 검색 중" style={styles.loadingState}>
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.statusMessage}>
          {state.query} 지역을 찾고 있어요.
        </Text>
      </View>
    );
  }
  if (state.status === 'not-found') {
    return (
      <StatusCard
        message="시/군/구까지 입력해 다시 검색해 주세요."
        title="검색 결과를 찾지 못했어요."
      />
    );
  }
  if (state.status === 'failure') {
    return (
      <StatusCard
        actionLabel="다시 시도"
        message="잠시 후 다시 검색해 주세요."
        onAction={onRetry}
        title="지역 검색에 실패했어요."
      />
    );
  }
  return (
    <StatusCard
      actionLabel={
        candidateHistory.length > 0 ? '검색 결과로 돌아가기' : undefined
      }
      message={formatRegionSelection(state.candidate.region)}
      onAction={
        candidateHistory.length > 0 ? onRestoreCandidates : undefined
      }
      title="선택한 지역"
    />
  );
}

type StatusCardProps = Readonly<{
  actionLabel?: string;
  message: string;
  onAction?: () => void;
  title: string;
}>;

function StatusCard({
  actionLabel,
  message,
  onAction,
  title,
}: StatusCardProps) {
  return (
    <View style={styles.statusCard}>
      <Text style={styles.statusTitle}>{title}</Text>
      <Text style={styles.statusMessage}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction}>
          <Text style={styles.statusAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const COLORS = {
  background: '#FFFFFF',
  onSurface: '#1A1C19',
  onSurfaceVariant: '#424940',
  outline: '#737A70',
  outlineVariant: '#DDE5DD',
  primary: '#2E7D32',
  primaryContainer: '#C8E6C9',
  surface: '#FFFFFF',
  surfaceContainerLow: '#FAFAF7',
  surfaceVariant: '#DDE5DD',
} as const;

const styles = StyleSheet.create({
  safeArea: { backgroundColor: COLORS.background, flex: 1 },
  content: { paddingBottom: 40, paddingHorizontal: 20, paddingTop: 20 },
  title: { color: COLORS.primary, fontSize: 24, fontWeight: '700' },
  description: {
    color: COLORS.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  searchContainer: { marginTop: 20 },
  searchField: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.outline,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 56,
  },
  searchFieldActive: { borderColor: COLORS.primary },
  searchFieldWithCandidates: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  searchInput: {
    color: COLORS.onSurface,
    flex: 1,
    fontSize: 16,
    minHeight: 54,
    paddingLeft: 16,
    paddingVertical: 0,
  },
  searchButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  searchIconCircle: {
    borderRadius: 7,
    borderWidth: 2,
    height: 14,
    width: 14,
  },
  searchIconHandle: {
    borderRadius: 1,
    height: 2,
    left: 11,
    position: 'absolute',
    top: 13,
    transform: [{ rotate: '45deg' }],
    width: 7,
  },
  candidatePanel: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderColor: COLORS.outlineVariant,
    borderWidth: 1,
    borderTopWidth: 0,
    maxHeight: 260,
    overflow: 'hidden',
  },
  candidateScrollView: { maxHeight: 260 },
  candidateRow: {
    backgroundColor: COLORS.surfaceContainerLow,
    minHeight: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  candidateDivider: { borderTopColor: COLORS.outlineVariant, borderTopWidth: 1 },
  candidatePressed: { backgroundColor: COLORS.primaryContainer },
  candidateText: {
    color: COLORS.onSurface,
    fontSize: 16,
    fontWeight: '500',
  },
  selectorCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.outlineVariant,
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    marginTop: 20,
    padding: 24,
  },
  selectorRow: { flexDirection: 'row', gap: 8 },
  selectorContainer: { flex: 1 },
  selector: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.outline,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  selectorSelected: {
    backgroundColor: COLORS.primaryContainer,
    borderColor: COLORS.primary,
  },
  selectorDisabled: {
    backgroundColor: COLORS.surfaceVariant,
    borderColor: COLORS.outlineVariant,
  },
  selectorText: {
    color: COLORS.onSurface,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  selectorTextDisabled: { color: COLORS.onSurfaceVariant },
  selectorArrow: { color: COLORS.onSurfaceVariant, fontSize: 18, marginLeft: 4 },
  selectedPath: { backgroundColor: COLORS.surface, borderRadius: 14 },
  selectedPathText: {
    color: COLORS.onSurface,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  lookupButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 44,
  },
  lookupButtonDisabled: { backgroundColor: COLORS.surfaceVariant },
  lookupButtonText: { color: COLORS.background, fontSize: 14, fontWeight: '700' },
  lookupButtonTextDisabled: { color: COLORS.onSurfaceVariant },
  dropdownOverlay: { flex: 1 },
  dropdownMenu: {
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    elevation: 8,
    maxHeight: 280,
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  dropdownOption: {
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  dropdownOptionSelected: { backgroundColor: COLORS.primaryContainer },
  dropdownOptionText: { color: COLORS.onSurface, fontSize: 14 },
  loadingState: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 40,
  },
  statusCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.outlineVariant,
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    marginTop: 20,
    padding: 24,
  },
  statusTitle: { color: COLORS.onSurface, fontSize: 16, fontWeight: '700' },
  statusMessage: {
    color: COLORS.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 20,
  },
  statusAction: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
    paddingVertical: 8,
  },
  pressed: { opacity: 0.72 },
});
