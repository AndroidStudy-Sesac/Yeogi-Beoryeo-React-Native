import { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import {
  runRegionSearchBenchmark,
  type RegionSearchBenchmarkResult,
} from "../data/regionSearchBenchmark";
import type { RegionSearchPerformanceSnapshot } from "../data/regionSearchClient";
import {
  estimateRegionModelBytes,
  getRegionAssetLoadMetrics,
} from "../data/regionRepository";

interface RegionPerformancePanelProps {
  searchPerformance?: RegionSearchPerformanceSnapshot;
}

export function isRegionPerformanceSpikeEnabled(): boolean {
  return process.env.EXPO_PUBLIC_ENABLE_REGION_PERFORMANCE_SPIKE === "1";
}

export function RegionPerformancePanel({
  searchPerformance,
}: RegionPerformancePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <View
      accessibilityLabel="지역 검색 성능 측정"
      style={[styles.panel, isExpanded && styles.expandedPanel]}
    >
      <Pressable
        accessibilityLabel={
          isExpanded ? "Spike 성능 측정 접기" : "Spike 성능 측정 열기"
        }
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        onPress={() => setIsExpanded((expanded) => !expanded)}
        style={styles.toggle}
      >
        <Text style={styles.title}>Spike 성능 측정 · {Platform.OS}</Text>
        <Text style={styles.toggleText}>
          {isExpanded ? "접기 ▲" : "열기 ▼"}
        </Text>
      </Pressable>

      {isExpanded ? (
        <RegionPerformanceDetails searchPerformance={searchPerformance} />
      ) : null}
    </View>
  );
}

function RegionPerformanceDetails({
  searchPerformance,
}: RegionPerformancePanelProps) {
  const assetMetrics = getRegionAssetLoadMetrics();
  const estimatedRegionModelBytes = useMemo(estimateRegionModelBytes, []);
  const [benchmark, setBenchmark] = useState<RegionSearchBenchmarkResult>();
  const [isRunning, setIsRunning] = useState(false);

  const runBenchmark = async () => {
    setIsRunning(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    setBenchmark(runRegionSearchBenchmark());
    setIsRunning(false);
  };

  return (
    <View style={styles.details}>
      <Text style={styles.value}>
        asset {formatBytes(assetMetrics.sourceBytes)} ·{" "}
        {assetMetrics.sourceRowCount.toLocaleString()}행
      </Text>
      {assetMetrics.sources.map((source) => (
        <Text key={source.name} style={styles.detail}>
          {source.name}: {formatBytes(source.sourceBytes)} ·{" "}
          {source.rowCount.toLocaleString()}행
        </Text>
      ))}
      <Text style={styles.detail}>
        최초 모듈 접근{" "}
        {formatMilliseconds(assetMetrics.moduleAccessMilliseconds)} · 변환{" "}
        {formatMilliseconds(assetMetrics.transformationMilliseconds)}
      </Text>
      <Text style={styles.detail}>
        Region {assetMetrics.outputRegionCount.toLocaleString()}개 · 잘못된 row{" "}
        {assetMetrics.invalidRecordCount}개 · 모델 직렬화{" "}
        {formatBytes(estimatedRegionModelBytes)}
      </Text>

      {searchPerformance?.indexBuildMilliseconds !== undefined ? (
        <>
          <Text style={styles.sectionTitle}>실제 검색</Text>
          <Text style={styles.detail}>
            첫 요청 총{" "}
            {formatOptionalMilliseconds(
              searchPerformance.firstRequestMilliseconds,
            )}{" "}
            · 최근 요청 총{" "}
            {formatOptionalMilliseconds(
              searchPerformance.latestRequestMilliseconds,
            )}
          </Text>
          <Text style={styles.detail}>
            인덱스{" "}
            {formatMilliseconds(searchPerformance.indexBuildMilliseconds)} ·
            후보 {searchPerformance.indexCandidateCount?.toLocaleString()}개 ·
            key {searchPerformance.indexLookupKeyCount?.toLocaleString()}개
          </Text>
          <Text style={styles.detail}>
            순수 검색: 첫{" "}
            {formatOptionalMilliseconds(
              searchPerformance.firstSearchMilliseconds,
            )}{" "}
            · 최근{" "}
            {formatOptionalMilliseconds(
              searchPerformance.latestSearchMilliseconds,
            )}{" "}
            · {searchPerformance.searchCount}회
          </Text>
          <Text style={styles.detail}>
            인덱스 생성 {searchPerformance.indexBuildCount}회
          </Text>
        </>
      ) : null}

      {benchmark ? (
        <>
          <Text style={styles.sectionTitle}>
            동일 검색 {benchmark.iterationCount}회 비교
          </Text>
          <Text style={styles.detail}>
            매번 재계산: 첫{" "}
            {formatMilliseconds(benchmark.baselineFirstSearchMilliseconds)} ·
            평균{" "}
            {formatMilliseconds(benchmark.baselineAverageSearchMilliseconds)} ·
            최대{" "}
            {formatMilliseconds(benchmark.baselineMaximumSearchMilliseconds)}
          </Text>
          <Text style={styles.detail}>
            인덱스 재사용: 생성{" "}
            {formatMilliseconds(benchmark.indexBuildMilliseconds)} · 첫 요청
            합계 {formatMilliseconds(benchmark.indexedFirstRequestMilliseconds)}
          </Text>
          <Text style={styles.detail}>
            순수 검색: 첫{" "}
            {formatMilliseconds(benchmark.indexedFirstSearchMilliseconds)} ·
            평균{" "}
            {formatMilliseconds(benchmark.indexedAverageSearchMilliseconds)} ·
            최대{" "}
            {formatMilliseconds(benchmark.indexedMaximumSearchMilliseconds)}
          </Text>
          <Text style={styles.detail}>
            인덱스 문자열 추정{" "}
            {formatBytes(benchmark.estimatedIndexStringBytes)}
          </Text>
          <Text style={styles.consistency}>
            결과 정합성: {benchmark.resultConsistency ? "동일" : "불일치"}
          </Text>
        </>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isRunning}
        onPress={() => void runBenchmark()}
        style={[styles.button, isRunning && styles.disabledButton]}
      >
        <Text style={styles.buttonText}>
          {isRunning ? "측정 중" : "재계산 / 인덱스 비교 실행"}
        </Text>
      </Pressable>
      <Text style={styles.notice}>
        직렬화 크기는 구조 비교용 추정값이며 실제 변환·인덱스 생성 시간에서
        제외합니다. 실제 JS heap은 Android Studio/Xcode profiler로 별도
        기록합니다.
      </Text>
    </View>
  );
}

function formatMilliseconds(value: number): string {
  return `${value.toFixed(2)}ms`;
}

function formatOptionalMilliseconds(value: number | undefined): string {
  return value === undefined ? "-" : formatMilliseconds(value);
}

function formatBytes(value: number): string {
  return value >= 1024 * 1024
    ? `${(value / (1024 * 1024)).toFixed(2)}MiB`
    : `${(value / 1024).toFixed(1)}KiB`;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#F7F9F7",
    borderColor: "#DCE8DD",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  expandedPanel: { paddingBottom: 14 },
  toggle: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
  },
  title: { color: "#16491A", fontSize: 15, fontWeight: "800" },
  toggleText: { color: "#2E7D32", fontSize: 12, fontWeight: "800" },
  details: { paddingHorizontal: 14 },
  sectionTitle: {
    color: "#2E7D32",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 10,
  },
  value: { color: "#202420", fontSize: 13, fontWeight: "700" },
  detail: { color: "#4D544D", fontSize: 12, lineHeight: 18, marginTop: 3 },
  consistency: {
    color: "#16491A",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 5,
  },
  button: {
    alignItems: "center",
    borderColor: "#2E7D32",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    paddingVertical: 9,
  },
  disabledButton: { opacity: 0.5 },
  buttonText: { color: "#2E7D32", fontSize: 13, fontWeight: "800" },
  notice: { color: "#697069", fontSize: 11, lineHeight: 16, marginTop: 8 },
});
