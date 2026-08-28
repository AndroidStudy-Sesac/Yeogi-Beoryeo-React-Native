import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  createRegionalGuideApiClient,
  type RegionalGuideApiClient,
} from "../data/regionalGuideApi";
import type { RegionSearchClient } from "../data/regionSearchClient";
import type { RegionalDisposalGuide } from "../domain/RegionalDisposalGuide";
import type { Region, RegionLevel } from "../domain/Region";
import type { RegionSearchCandidate } from "../domain/RegionSearchModel";
import { useRegionalGuide } from "./useRegionalGuide";
import { useRegionalGuideApiValidation } from "./useRegionalGuideApiValidation";
import { useRegionSearch } from "./useRegionSearch";

interface DropdownAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

const fallbackDropdownAnchor: DropdownAnchor = {
  x: 20,
  y: 0,
  width: 300,
  height: 58,
};

interface RegionDropdownTriggerProps {
  level: RegionLevel;
  label: string;
  selectedRegion?: Region;
  expanded: boolean;
  enabled: boolean;
  onOpen: (anchor: DropdownAnchor) => void;
  onClose: () => void;
}

interface RegionDropdownProps {
  level: RegionLevel;
  label: string;
  selectedRegion?: Region;
  regions: Region[];
  expanded: boolean;
  enabled: boolean;
  anchor?: DropdownAnchor;
  onOpen: (anchor: DropdownAnchor) => void;
  onClose: () => void;
  onSelect: (region: Region) => void;
}

function RegionDropdown({
  level,
  label,
  selectedRegion,
  regions,
  expanded,
  enabled,
  anchor,
  onOpen,
  onClose,
  onSelect,
}: RegionDropdownProps) {
  return (
    <View
      style={[
        styles.dropdownContainer,
        level === "eupmyeondong" && styles.eupmyeondongDropdownContainer,
      ]}
    >
      <RegionDropdownTrigger
        level={level}
        label={label}
        selectedRegion={selectedRegion}
        expanded={expanded}
        enabled={enabled}
        onOpen={onOpen}
        onClose={onClose}
      />
      {expanded && anchor ? (
        <RegionDropdownMenu
          anchor={anchor}
          level={level}
          label={label}
          regions={regions}
          selectedId={selectedRegion?.id}
          onDismiss={onClose}
          onSelect={onSelect}
        />
      ) : null}
    </View>
  );
}

function RegionDropdownTrigger({
  level,
  label,
  selectedRegion,
  expanded,
  enabled,
  onOpen,
  onClose,
}: RegionDropdownTriggerProps) {
  const triggerRef = useRef<View>(null);

  const handlePress = () => {
    if (expanded) {
      onClose();
      return;
    }

    const trigger = triggerRef.current;
    onOpen(fallbackDropdownAnchor);
    trigger?.measureInWindow((x, y, width, height) => {
      onOpen({ x, y, width, height });
    });
  };

  return (
    <Pressable
      ref={triggerRef}
      accessibilityLabel={`${label} 선택 드롭다운`}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled, expanded }}
      disabled={!enabled}
      onPress={handlePress}
      style={[
        styles.dropdownTrigger,
        level === "eupmyeondong" && styles.eupmyeondongTrigger,
        selectedRegion && styles.selectedDropdownTrigger,
        !enabled && styles.disabledDropdownTrigger,
      ]}
    >
      {level === "eupmyeondong" ? null : (
        <Text style={styles.dropdownLabel}>{label}</Text>
      )}
      <Text
        numberOfLines={1}
        style={[
          styles.dropdownValue,
          selectedRegion && styles.selectedDropdownValue,
        ]}
      >
        {selectedRegion?.name ?? `${label} 선택`}
      </Text>
      <Text style={styles.dropdownArrow}>{expanded ? "▲" : "▼"}</Text>
    </Pressable>
  );
}

interface RegionDropdownMenuProps {
  anchor: DropdownAnchor;
  level: RegionLevel;
  label: string;
  regions: Region[];
  selectedId?: string;
  onDismiss: () => void;
  onSelect: (region: Region) => void;
}

function RegionDropdownMenu({
  anchor,
  level,
  label,
  regions,
  selectedId,
  onDismiss,
  onSelect,
}: RegionDropdownMenuProps) {
  return (
    <Modal
      animationType="none"
      statusBarTranslucent
      transparent
      visible
      onRequestClose={onDismiss}
    >
      <View style={styles.dropdownOverlay}>
        <Pressable
          accessibilityLabel={`${label} 선택 닫기`}
          accessibilityRole="button"
          onPress={onDismiss}
          style={styles.dropdownDismiss}
        />
        <ScrollView
          accessibilityLabel={`${label} 옵션 목록`}
          contentContainerStyle={styles.dropdownMenuContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          style={[
            styles.dropdownMenu,
            {
              left: anchor.x,
              top: anchor.y + anchor.height + 4,
              width: anchor.width,
            },
          ]}
        >
          {regions.map((region) => {
            const isSelected = region.id === selectedId;
            return (
              <Pressable
                key={region.id}
                accessibilityLabel={`${levelLabel(level)} 옵션: ${region.name}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => onSelect(region)}
                style={[
                  styles.dropdownOption,
                  isSelected && styles.selectedDropdownOption,
                ]}
              >
                <Text
                  style={[
                    styles.dropdownOptionText,
                    isSelected && styles.selectedDropdownOptionText,
                  ]}
                >
                  {region.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

interface RegionalGuideScreenProps {
  regionalGuideApiClient?: RegionalGuideApiClient;
  regionSearchClient?: RegionSearchClient;
}

export function RegionalGuideScreen({
  regionalGuideApiClient,
  regionSearchClient,
}: RegionalGuideScreenProps) {
  const {
    selected,
    sidoRegions,
    sigunguRegions,
    eupmyeondongRegions,
    select,
    selectRegion: selectRegionPath,
  } = useRegionalGuide();
  const defaultApiClient = useMemo(() => createRegionalGuideApiClient(), []);
  const apiClient = regionalGuideApiClient ?? defaultApiClient;
  const {
    state: apiValidationState,
    validate,
    reset: resetValidation,
  } = useRegionalGuideApiValidation(apiClient);
  const {
    query: searchQuery,
    state: regionSearchState,
    setQuery: setSearchQuery,
    search,
    cancel: cancelSearch,
    selectCandidate,
    restoreCandidates,
  } = useRegionSearch(regionSearchClient);
  const [expandedDropdown, setExpandedDropdown] = useState<{
    level: RegionLevel;
    anchor: DropdownAnchor;
  }>();
  const [confirmedPath, setConfirmedPath] = useState("");
  const [candidateHistory, setCandidateHistory] = useState<
    RegionSearchCandidate[]
  >([]);
  const selectedPath = [selected.sido, selected.sigungu, selected.eupmyeondong]
    .filter((region): region is Region => Boolean(region))
    .map((region) => region.name)
    .join(" > ");
  const canLookup = Boolean(selected.sido && selected.sigungu);

  useEffect(() => {
    if (regionSearchState.status !== "resolved") return;

    const candidate = regionSearchState.candidate;
    selectRegionPath(candidate.region);
    setConfirmedPath(
      [
        candidate.region.sido,
        candidate.region.sigungu,
        candidate.region.eupmyeondong,
      ]
        .filter(
          (region): region is Region =>
            Boolean(region) && region?.name !== "없음",
        )
        .map((region) => region.name)
        .join(" > "),
    );
    if (candidate.region.sigungu) {
      void validate(candidate.region.sigungu.name);
    }
  }, [regionSearchState, selectRegionPath, validate]);

  const openDropdown = (level: RegionLevel, anchor: DropdownAnchor) => {
    setExpandedDropdown({ level, anchor });
  };

  const closeDropdown = () => setExpandedDropdown(undefined);

  const selectDropdownRegion = (level: RegionLevel, region: Region) => {
    select(level, region);
    resetValidation();
    setConfirmedPath("");
    closeDropdown();
  };

  const confirmSelection = () => {
    if (!selected.sigungu || !canLookup) return;
    closeDropdown();
    setConfirmedPath(selectedPath);
    void validate(selected.sigungu.name);
  };

  const submitSearch = () => {
    Keyboard.dismiss();
    void search();
  };

  const changeSearchQuery = (value: string) => {
    setCandidateHistory([]);
    setConfirmedPath("");
    resetValidation();
    setSearchQuery(value);
  };

  const clearSearch = () => {
    Keyboard.dismiss();
    setCandidateHistory([]);
    setConfirmedPath("");
    resetValidation();
    cancelSearch();
  };

  const chooseSearchCandidate = (candidate: RegionSearchCandidate) => {
    if (regionSearchState.status === "candidates") {
      setCandidateHistory(regionSearchState.candidates);
    }
    Keyboard.dismiss();
    selectCandidate(candidate);
  };

  const returnToCandidates = () => {
    setConfirmedPath("");
    resetValidation();
    restoreCandidates(candidateHistory);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>지역별 배출 가이드</Text>
          <Text style={styles.subtitle}>
            지역명을 입력하면 생활쓰레기, 음식물쓰레기, 재활용품 배출 정보를
            확인할 수 있어요.
          </Text>
        </View>

        <View style={styles.searchBar}>
          <TextInput
            accessibilityLabel="지역명 또는 주소 검색"
            autoCorrect={false}
            onChangeText={changeSearchQuery}
            onSubmitEditing={submitSearch}
            placeholder="지역명 또는 주소를 검색해주세요."
            placeholderTextColor="#697069"
            returnKeyType="search"
            style={styles.searchInput}
            value={searchQuery}
          />
          {searchQuery ? (
            <Pressable
              accessibilityLabel="지역 검색 취소"
              accessibilityRole="button"
              hitSlop={8}
              onPress={clearSearch}
            >
              <Text style={styles.cancelSearchText}>취소</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityLabel="지역 검색 실행"
              accessibilityRole="button"
              hitSlop={8}
              onPress={submitSearch}
            >
              <Text style={styles.searchIcon}>⌕</Text>
            </Pressable>
          )}
        </View>

        <RegionSearchResult
          state={regionSearchState}
          onRetry={submitSearch}
          onSelect={chooseSearchCandidate}
        />

        <View style={styles.selectorCard}>
          <View style={styles.topDropdowns}>
            <RegionDropdown
              level="sido"
              label="시·도"
              selectedRegion={selected.sido}
              regions={sidoRegions}
              expanded={expandedDropdown?.level === "sido"}
              enabled
              anchor={expandedDropdown?.anchor}
              onOpen={(anchor) => openDropdown("sido", anchor)}
              onClose={closeDropdown}
              onSelect={(region) => selectDropdownRegion("sido", region)}
            />
            <RegionDropdown
              level="sigungu"
              label="시·군·구"
              selectedRegion={selected.sigungu}
              regions={sigunguRegions}
              expanded={expandedDropdown?.level === "sigungu"}
              enabled={Boolean(selected.sido)}
              anchor={expandedDropdown?.anchor}
              onOpen={(anchor) => openDropdown("sigungu", anchor)}
              onClose={closeDropdown}
              onSelect={(region) => selectDropdownRegion("sigungu", region)}
            />
          </View>

          <RegionDropdown
            level="eupmyeondong"
            label="읍면동"
            selectedRegion={selected.eupmyeondong}
            regions={eupmyeondongRegions}
            expanded={expandedDropdown?.level === "eupmyeondong"}
            enabled={Boolean(selected.sigungu)}
            anchor={expandedDropdown?.anchor}
            onOpen={(anchor) => openDropdown("eupmyeondong", anchor)}
            onClose={closeDropdown}
            onSelect={(region) => selectDropdownRegion("eupmyeondong", region)}
          />

          {selectedPath ? (
            <Text style={styles.selectedPath}>{selectedPath}</Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canLookup }}
            disabled={!canLookup}
            onPress={confirmSelection}
            style={[
              styles.lookupButton,
              !canLookup && styles.disabledLookupButton,
            ]}
          >
            <Text style={styles.lookupButtonText}>조회</Text>
          </Pressable>

          {confirmedPath ? (
            <View style={styles.confirmedRegion}>
              <Text style={styles.confirmedRegionLabel}>선택한 지역</Text>
              <Text style={styles.confirmedRegionValue}>{confirmedPath}</Text>
              {candidateHistory.length > 1 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={returnToCandidates}
                >
                  <Text style={styles.returnToCandidatesText}>
                    검색 결과로 돌아가기
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <RegionalGuideApiValidationResult state={apiValidationState} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface RegionalGuideApiValidationResultProps {
  state: ReturnType<typeof useRegionalGuideApiValidation>["state"];
}

interface RegionSearchResultProps {
  state: ReturnType<typeof useRegionSearch>["state"];
  onRetry: () => void;
  onSelect: (candidate: RegionSearchCandidate) => void;
}

function RegionSearchResult({
  state,
  onRetry,
  onSelect,
}: RegionSearchResultProps) {
  if (state.status === "empty" || state.status === "idle") return null;

  if (state.status === "searching") {
    return (
      <View accessibilityLabel="지역 검색 중" style={styles.searchStateCard}>
        <ActivityIndicator color="#2E7D32" size="small" />
        <Text style={styles.searchStateText}>지역 후보를 찾고 있어요.</Text>
      </View>
    );
  }

  if (state.status === "not-found") {
    return (
      <View style={styles.searchStateCard}>
        <Text style={styles.searchStateTitle}>지역 후보가 없습니다.</Text>
        <Text style={styles.searchStateText}>
          시·도와 시·군·구를 함께 입력해 다시 검색해주세요.
        </Text>
      </View>
    );
  }

  if (state.status === "failure") {
    return (
      <View style={styles.searchStateCard}>
        <Text style={styles.searchStateTitle}>지역 검색에 실패했습니다.</Text>
        <Pressable accessibilityRole="button" onPress={onRetry}>
          <Text style={styles.retrySearchText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  if (state.status === "resolved") return null;

  return (
    <View style={styles.candidateCard}>
      <Text style={styles.searchStateTitle}>
        {state.candidates.length}개의 지역 후보
      </Text>
      <Text style={styles.searchStateText}>조회할 지역을 선택해주세요.</Text>
      <ScrollView
        accessibilityLabel="지역 검색 후보 목록"
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        style={styles.candidateList}
      >
        {state.candidates.map((candidate) => (
          <Pressable
            key={candidate.id}
            accessibilityLabel={`지역 후보: ${candidate.displayName}`}
            accessibilityRole="button"
            onPress={() => onSelect(candidate)}
            style={styles.candidateItem}
          >
            <Text style={styles.candidateItemText}>
              {candidate.displayName}
            </Text>
            <Text style={styles.candidateItemArrow}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function RegionalGuideApiValidationResult({
  state,
}: RegionalGuideApiValidationResultProps) {
  if (state.status === "idle") return null;

  if (state.status === "loading") {
    return (
      <Text style={styles.validationMessage}>API 응답을 확인하고 있어요.</Text>
    );
  }
  if (state.status === "not-found") {
    return <Text style={styles.validationMessage}>조회 결과가 없습니다.</Text>;
  }
  if (state.status === "failure") {
    return (
      <Text style={styles.validationMessage}>
        API 검증 실패: {failureLabel(state.reason)}
      </Text>
    );
  }

  return (
    <View style={styles.validationResult}>
      <Text style={styles.validationTitle}>API 검증 성공</Text>
      <Text style={styles.validationValue}>{guideSummary(state.guide)}</Text>
    </View>
  );
}

function guideSummary(guide: RegionalDisposalGuide): string {
  const region = [guide.sidoName, guide.sigunguName, guide.targetRegionName]
    .filter(Boolean)
    .join(" > ");
  const schedules = guide.schedules
    .map(
      (schedule) =>
        `${wasteTypeLabel(schedule.wasteType)} ${schedule.disposalDays ?? "미지정"}`,
    )
    .join(", ");

  return [region, schedules].filter(Boolean).join(" · ");
}

function wasteTypeLabel(wasteType: "general" | "food" | "recyclable"): string {
  if (wasteType === "general") return "생활폐기물";
  if (wasteType === "food") return "음식물쓰레기";
  return "재활용품";
}

function failureLabel(reason: string): string {
  if (reason === "network") return "네트워크 오류";
  if (reason === "api") return "API 오류";
  if (reason === "configuration") return "API 키 설정 오류";
  return "알 수 없는 오류";
}

function levelLabel(level: RegionLevel): string {
  if (level === "sido") return "시·도";
  if (level === "sigungu") return "시·군·구";
  return "읍면동";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  content: {
    flexGrow: 1,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  header: { marginBottom: 22 },
  title: { color: "#2E7D32", fontSize: 28, fontWeight: "800" },
  subtitle: {
    color: "#4D544D",
    fontSize: 15,
    lineHeight: 24,
    marginTop: 12,
  },
  searchBar: {
    alignItems: "center",
    borderColor: "#737B73",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  searchInput: { color: "#414741", flex: 1, fontSize: 16, paddingVertical: 15 },
  searchIcon: { color: "#414741", fontSize: 30, lineHeight: 32 },
  cancelSearchText: { color: "#2E7D32", fontSize: 14, fontWeight: "700" },
  searchStateCard: {
    alignItems: "center",
    backgroundColor: "#F5F8F5",
    borderRadius: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
    padding: 16,
  },
  searchStateTitle: { color: "#202420", fontSize: 15, fontWeight: "800" },
  searchStateText: { color: "#596159", fontSize: 14, lineHeight: 20 },
  retrySearchText: { color: "#2E7D32", fontSize: 14, fontWeight: "800" },
  candidateCard: {
    backgroundColor: "#F5F8F5",
    borderRadius: 14,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  candidateList: { marginTop: 8, maxHeight: 240 },
  candidateItem: {
    alignItems: "center",
    borderTopColor: "#DCE3DC",
    borderTopWidth: 1,
    flexDirection: "row",
    minHeight: 50,
    paddingVertical: 12,
  },
  candidateItemText: {
    color: "#202420",
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  candidateItemArrow: { color: "#2E7D32", fontSize: 24 },
  selectorCard: {
    borderColor: "#DCE8DD",
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  topDropdowns: { flexDirection: "row", gap: 10, marginBottom: 16 },
  dropdownContainer: { flex: 1 },
  eupmyeondongDropdownContainer: { flex: 0, marginBottom: 10 },
  dropdownTrigger: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#DCE3DC",
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 58,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 8,
  },
  eupmyeondongTrigger: {
    alignItems: "flex-start",
    minHeight: 48,
    paddingHorizontal: 16,
  },
  selectedDropdownTrigger: {
    backgroundColor: "#C8E6C9",
    borderColor: "#C8E6C9",
  },
  disabledDropdownTrigger: { backgroundColor: "#F1F3F1", opacity: 0.65 },
  dropdownLabel: { color: "#536053", fontSize: 12, marginBottom: 4 },
  dropdownValue: { color: "#4D544D", fontSize: 15, fontWeight: "700" },
  selectedDropdownValue: { color: "#16491A" },
  dropdownArrow: {
    color: "#536053",
    fontSize: 9,
    position: "absolute",
    right: 12,
  },
  dropdownOverlay: { flex: 1 },
  dropdownDismiss: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  dropdownMenu: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E5E2",
    borderRadius: 6,
    borderWidth: 1,
    elevation: 5,
    maxHeight: 260,
    position: "absolute",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
  },
  dropdownMenuContent: { paddingVertical: 4 },
  dropdownOption: {
    borderBottomColor: "#ECEEEC",
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectedDropdownOption: { backgroundColor: "#EAF6EA" },
  dropdownOptionText: { color: "#242824", fontSize: 15 },
  selectedDropdownOptionText: { color: "#2E7D32", fontWeight: "700" },
  selectedPath: {
    color: "#202420",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 18,
    marginTop: 8,
  },
  lookupButton: {
    alignItems: "center",
    backgroundColor: "#2E7D32",
    borderRadius: 14,
    paddingVertical: 14,
  },
  disabledLookupButton: { backgroundColor: "#C8D0C8" },
  lookupButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  confirmedRegion: {
    backgroundColor: "#EFF8EF",
    borderRadius: 12,
    marginTop: 14,
    padding: 14,
  },
  confirmedRegionLabel: { color: "#4D654F", fontSize: 12 },
  confirmedRegionValue: {
    color: "#16491A",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
  },
  returnToCandidatesText: {
    color: "#2E7D32",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 10,
  },
  validationResult: {
    backgroundColor: "#EFF8EF",
    borderRadius: 12,
    marginTop: 14,
    padding: 14,
  },
  validationTitle: { color: "#2E7D32", fontSize: 13, fontWeight: "800" },
  validationValue: {
    color: "#16491A",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 5,
  },
  validationMessage: { color: "#4D544D", fontSize: 14, marginTop: 14 },
});
