import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { Region, RegionLevel } from "../domain/Region";
import { useRegionalGuide } from "./useRegionalGuide";

interface RegionDropdownTriggerProps {
  level: RegionLevel;
  label: string;
  selectedRegion?: Region;
  expanded: boolean;
  enabled: boolean;
  onPress: () => void;
}

interface RegionDropdownProps {
  level: RegionLevel;
  label: string;
  selectedRegion?: Region;
  regions: Region[];
  expanded: boolean;
  enabled: boolean;
  onToggle: () => void;
  onSelect: (region: Region) => void;
}

function RegionDropdown({
  level,
  label,
  selectedRegion,
  regions,
  expanded,
  enabled,
  onToggle,
  onSelect,
}: RegionDropdownProps) {
  return (
    <View
      style={[
        styles.dropdownContainer,
        level === "eupmyeondong" && styles.eupmyeondongDropdownContainer,
        expanded && styles.expandedDropdownContainer,
      ]}
    >
      <RegionDropdownTrigger
        level={level}
        label={label}
        selectedRegion={selectedRegion}
        expanded={expanded}
        enabled={enabled}
        onPress={onToggle}
      />
      {expanded ? (
        <RegionDropdownMenu
          level={level}
          regions={regions}
          selectedId={selectedRegion?.id}
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
  onPress,
}: RegionDropdownTriggerProps) {
  return (
    <Pressable
      accessibilityLabel={`${label} 선택 드롭다운`}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled, expanded }}
      disabled={!enabled}
      onPress={onPress}
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
  level: RegionLevel;
  regions: Region[];
  selectedId?: string;
  onSelect: (region: Region) => void;
}

function RegionDropdownMenu({
  level,
  regions,
  selectedId,
  onSelect,
}: RegionDropdownMenuProps) {
  return (
    <ScrollView
      nestedScrollEnabled
      style={[
        styles.dropdownMenu,
        level === "eupmyeondong" && styles.eupmyeondongDropdownMenu,
      ]}
      contentContainerStyle={styles.dropdownMenuContent}
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
  );
}

export function RegionalGuideScreen() {
  const { selected, sidoRegions, sigunguRegions, eupmyeondongRegions, select } =
    useRegionalGuide();
  const [expandedLevel, setExpandedLevel] = useState<RegionLevel>();
  const [confirmedPath, setConfirmedPath] = useState("");
  const selectedPath = [selected.sido, selected.sigungu, selected.eupmyeondong]
    .filter((region): region is Region => Boolean(region))
    .map((region) => region.name)
    .join(" > ");
  const canLookup = Boolean(selected.sido && selected.sigungu);

  const toggleDropdown = (level: RegionLevel) => {
    setExpandedLevel((current) => (current === level ? undefined : level));
  };

  const selectRegion = (level: RegionLevel, region: Region) => {
    select(level, region);
    setConfirmedPath("");
    setExpandedLevel(undefined);
  };

  const confirmSelection = () => {
    if (!canLookup) return;
    setExpandedLevel(undefined);
    setConfirmedPath(selectedPath);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
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
            editable={false}
            placeholder="지역명 또는 주소를 검색해주세요."
            placeholderTextColor="#697069"
            style={styles.searchInput}
          />
          <Text style={styles.searchIcon}>⌕</Text>
        </View>

        <View style={styles.selectorCard}>
          <View style={styles.topDropdowns}>
            <RegionDropdown
              level="sido"
              label="시·도"
              selectedRegion={selected.sido}
              regions={sidoRegions}
              expanded={expandedLevel === "sido"}
              enabled
              onToggle={() => toggleDropdown("sido")}
              onSelect={(region) => selectRegion("sido", region)}
            />
            <RegionDropdown
              level="sigungu"
              label="시·군·구"
              selectedRegion={selected.sigungu}
              regions={sigunguRegions}
              expanded={expandedLevel === "sigungu"}
              enabled={Boolean(selected.sido)}
              onToggle={() => toggleDropdown("sigungu")}
              onSelect={(region) => selectRegion("sigungu", region)}
            />
          </View>

          <RegionDropdown
            level="eupmyeondong"
            label="읍면동"
            selectedRegion={selected.eupmyeondong}
            regions={eupmyeondongRegions}
            expanded={expandedLevel === "eupmyeondong"}
            enabled={Boolean(selected.sigungu)}
            onToggle={() => toggleDropdown("eupmyeondong")}
            onSelect={(region) => selectRegion("eupmyeondong", region)}
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
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

function levelLabel(level: RegionLevel): string {
  if (level === "sido") return "시·도";
  if (level === "sigungu") return "시·군·구";
  return "읍면동";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
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
  selectorCard: {
    borderColor: "#DCE8DD",
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  topDropdowns: { flexDirection: "row", gap: 10, marginBottom: 16 },
  dropdownContainer: { flex: 1, zIndex: 1 },
  eupmyeondongDropdownContainer: { flex: 0, marginBottom: 10 },
  expandedDropdownContainer: { zIndex: 10 },
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
  dropdownMenu: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E5E2",
    borderRadius: 6,
    borderWidth: 1,
    elevation: 5,
    left: 0,
    maxHeight: 260,
    position: "absolute",
    right: 0,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    top: 62,
    zIndex: 20,
  },
  eupmyeondongDropdownMenu: { top: 52 },
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
});
