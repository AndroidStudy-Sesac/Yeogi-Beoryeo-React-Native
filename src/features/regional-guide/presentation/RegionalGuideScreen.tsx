import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { Region, RegionLevel } from "../domain/Region";
import { useRegionalGuide } from "./useRegionalGuide";

interface RegionColumnProps {
  title: string;
  regions: Region[];
  selectedId?: string;
  onSelect: (region: Region) => void;
}

function RegionColumn({
  title,
  regions,
  selectedId,
  onSelect,
}: RegionColumnProps) {
  return (
    <View style={styles.column}>
      <Text style={styles.columnTitle}>{title}</Text>
      <ScrollView contentContainerStyle={styles.regionList}>
        {regions.length === 0 ? (
          <Text style={styles.empty}>상위 지역을 먼저 선택하세요</Text>
        ) : (
          regions.map((region) => {
            const isSelected = region.id === selectedId;
            return (
              <Pressable
                key={region.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => onSelect(region)}
                style={[
                  styles.regionButton,
                  isSelected && styles.selectedRegionButton,
                ]}
              >
                <Text
                  style={[
                    styles.regionName,
                    isSelected && styles.selectedRegionName,
                  ]}
                >
                  {region.name}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

export function RegionalGuideScreen() {
  const { selected, sidoRegions, sigunguRegions, eupmyeondongRegions, select } =
    useRegionalGuide();
  const columns: Array<{
    level: RegionLevel;
    title: string;
    regions: Region[];
    selectedId?: string;
  }> = [
    {
      level: "sido",
      title: "시·도",
      regions: sidoRegions,
      selectedId: selected.sido?.id,
    },
    {
      level: "sigungu",
      title: "시·군·구",
      regions: sigunguRegions,
      selectedId: selected.sigungu?.id,
    },
    {
      level: "eupmyeondong",
      title: "읍·면·동",
      regions: eupmyeondongRegions,
      selectedId: selected.eupmyeondong?.id,
    },
  ];
  const selectedPath = [selected.sido, selected.sigungu, selected.eupmyeondong]
    .filter((region): region is Region => Boolean(region))
    .map((region) => region.name)
    .join(" > ");

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>지역 가이드</Text>
        <Text style={styles.subtitle}>
          내 지역을 선택하고 맞춤 정보를 확인하세요.
        </Text>
      </View>
      <View style={styles.columns}>
        {columns.map((column) => (
          <RegionColumn
            key={column.level}
            title={column.title}
            regions={column.regions}
            selectedId={column.selectedId}
            onSelect={(region) => select(column.level, region)}
          />
        ))}
      </View>
      <View style={styles.selectionSummary}>
        <Text style={styles.summaryLabel}>선택한 지역</Text>
        <Text style={styles.summaryValue}>
          {selectedPath || "지역을 선택해 주세요."}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },
  title: { color: "#171717", fontSize: 26, fontWeight: "700" },
  subtitle: { color: "#737373", fontSize: 14, marginTop: 8 },
  columns: {
    flex: 1,
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: "#E5E5E5",
  },
  column: { flex: 1, borderRightWidth: 1, borderColor: "#E5E5E5" },
  columnTitle: {
    color: "#404040",
    fontSize: 15,
    fontWeight: "700",
    padding: 12,
    textAlign: "center",
  },
  regionList: { paddingHorizontal: 6, paddingBottom: 12 },
  regionButton: {
    borderRadius: 8,
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 11,
  },
  selectedRegionButton: { backgroundColor: "#FFF0EB" },
  regionName: { color: "#525252", fontSize: 14, textAlign: "center" },
  selectedRegionName: { color: "#E44F2B", fontWeight: "700" },
  empty: {
    color: "#A3A3A3",
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 4,
    paddingTop: 12,
    textAlign: "center",
  },
  selectionSummary: {
    backgroundColor: "#FFF7F4",
    borderTopWidth: 1,
    borderColor: "#F6D6CB",
    padding: 20,
  },
  summaryLabel: { color: "#9A3412", fontSize: 13, fontWeight: "700" },
  summaryValue: {
    color: "#431407",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 5,
  },
});
