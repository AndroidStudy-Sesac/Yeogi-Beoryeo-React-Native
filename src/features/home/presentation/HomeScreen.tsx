import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { RegionalGuideApiClient } from "../../regional-guide/data/regionalGuideApi";
import type { HomeRegionalGuideScheduleSummary } from "../../regional-guide/domain/HomeRegionalGuideSummary";
import type {
  RegionalDisposalGuide,
  RegionalGuideFailureReason,
  RegionalWasteType,
} from "../../regional-guide/domain/RegionalDisposalGuide";
import type { RegionalGuideId } from "../../regional-guide/domain/RegionalGuideFavorite";
import type { RegionalGuideFavoritesController } from "../../regional-guide/presentation/useRegionalGuideFavorites";
import type { HomeRegionalGuideRepresentativeController } from "../../regional-guide/presentation/useHomeRegionalGuideRepresentative";
import { useHomeRegionalGuideSummary } from "../../regional-guide/presentation/useHomeRegionalGuideSummary";

interface HomeScreenProps {
  active: boolean;
  apiClient: RegionalGuideApiClient;
  favorites: RegionalGuideFavoritesController;
  representative: HomeRegionalGuideRepresentativeController;
  onOpenDetail: (
    guideId?: RegionalGuideId,
    guide?: RegionalDisposalGuide,
  ) => void;
  onOpenGuide: () => void;
  onOpenSaved: () => void;
}

export function HomeScreen({
  active,
  apiClient,
  favorites,
  representative,
  onOpenDetail,
  onOpenGuide,
  onOpenSaved,
}: HomeScreenProps) {
  const representativeGuideId =
    representative.state.status === "ready"
      ? representative.state.guideId
      : undefined;
  const { state: summaryState, retry } = useHomeRegionalGuideSummary(
    representativeGuideId,
    apiClient,
    active,
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        accessibilityLabel="홈 콘텐츠"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>여기 버려</Text>
          <Text style={styles.subtitle}>
            품목 검색, 수거 장소, 지역별 배출 정보를 한 곳에서 확인하세요.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>안내 사항</Text>
          {summaryState.status === "ready" ? (
            <Pressable
              accessibilityLabel="대표 지역 배출 안내 상세 열기"
              accessibilityRole="button"
              onPress={() =>
                onOpenDetail(summaryState.guideId, summaryState.guide)
              }
            >
              <Text style={styles.linkText}>상세 보기 ›</Text>
            </Pressable>
          ) : null}
        </View>

        <SummaryCard
          favoriteCount={
            favorites.state.status === "ready"
              ? favorites.state.guideIds.length
              : 0
          }
          state={summaryState}
          representativeStatus={representative.state.status}
          onOpenGuide={onOpenGuide}
          onOpenSaved={onOpenSaved}
          onRetry={() => void retry()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

interface SummaryCardProps {
  state: ReturnType<typeof useHomeRegionalGuideSummary>["state"];
  representativeStatus: HomeRegionalGuideRepresentativeController["state"]["status"];
  favoriteCount: number;
  onOpenGuide: () => void;
  onOpenSaved: () => void;
  onRetry: () => void;
}

function SummaryCard({
  state,
  representativeStatus,
  favoriteCount,
  onOpenGuide,
  onOpenSaved,
  onRetry,
}: SummaryCardProps) {
  if (representativeStatus === "restoring" || state.status === "loading") {
    return (
      <View
        accessibilityLabel="홈 대표 지역 복원 및 조회 중"
        style={styles.card}
      >
        <ActivityIndicator color="#2E7D32" />
        <Text style={styles.stateTitle}>대표 지역 안내를 불러오는 중</Text>
      </View>
    );
  }

  if (state.status === "no-representative") {
    return (
      <View accessibilityLabel="홈 대표 지역 없음" style={styles.card}>
        <Text style={styles.stateTitle}>대표 지역이 없습니다.</Text>
        <Text style={styles.stateDescription}>
          {favoriteCount > 0
            ? "저장 탭의 지역 목록에서 홈에 표시할 지역을 핀으로 고정해주세요."
            : "안내 탭에서 지역을 조회하고 즐겨찾기에 먼저 저장해주세요."}
        </Text>
        <ActionButton
          label={
            favoriteCount > 0 ? "저장한 지역에서 고정" : "지역 가이드로 이동"
          }
          onPress={favoriteCount > 0 ? onOpenSaved : onOpenGuide}
        />
      </View>
    );
  }

  if (state.status === "not-found" || state.status === "not-provided") {
    return (
      <View
        accessibilityLabel="홈 대표 지역 배출 안내 결과 없음"
        style={styles.card}
      >
        <Text style={styles.stateTitle}>
          {state.status === "not-found"
            ? "배출 안내 결과가 없습니다."
            : "이 지역의 상세 안내가 제공되지 않습니다."}
        </Text>
        <Text style={styles.stateDescription}>
          대표 지역은 유지됩니다. 최신 데이터가 등록되었는지 다시 확인해보세요.
        </Text>
        <ActionButton label="다시 조회" onPress={onRetry} />
      </View>
    );
  }

  if (state.status === "failure") {
    return (
      <View
        accessibilityLabel={`홈 대표 지역 조회 실패: ${failureLabel(state.reason)}`}
        style={styles.card}
      >
        <Text style={styles.stateTitle}>배출 안내를 불러오지 못했습니다.</Text>
        <Text style={styles.stateDescription}>
          {failureDescription(state.reason)}
        </Text>
        <ActionButton label="다시 조회" onPress={onRetry} />
      </View>
    );
  }

  const schedule = representativeSchedule(state.summary.schedules);

  return (
    <View
      accessibilityLabel="홈 대표 지역 배출 안내"
      style={styles.summaryCard}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <Text style={styles.guideLabel}>지역별 배출 가이드</Text>
          <Text style={styles.regionName}>{state.summary.regionName}</Text>
        </View>
        {state.isRefreshing ? (
          <ActivityIndicator color="#2E7D32" size="small" />
        ) : null}
      </View>
      <View style={styles.summaryTiles}>
        <SummaryTile label="배출 요일" value={schedule?.disposalDays} />
        <SummaryTile label="배출 시간" value={schedule?.disposalTime} />
      </View>
      <Text style={styles.summaryFooter}>
        {schedule
          ? `${wasteTypeLabel(schedule.wasteType)} 기준입니다.\n상세 안내에서 확인해 주세요.`
          : "상세 안내에서 배출 일정을 확인해 주세요."}
      </Text>
      {state.isPartial ? (
        <Text style={styles.notice}>일부 조회 결과를 표시하고 있습니다.</Text>
      ) : null}
      {state.refreshError ? (
        <View style={styles.refreshError}>
          <Text style={styles.notice}>
            최신 정보를 불러오지 못해 이전 정상 결과를 표시합니다.
          </Text>
          <Pressable accessibilityRole="button" onPress={onRetry}>
            <Text style={styles.linkText}>다시 조회</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function SummaryTile({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryTileLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.summaryTileValue}>
        {value ?? "상세 안내 확인"}
      </Text>
    </View>
  );
}

function representativeSchedule(schedules: HomeRegionalGuideScheduleSummary[]) {
  return (
    schedules.find((schedule) => schedule.wasteType === "general") ??
    schedules[0]
  );
}

function ActionButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.actionButton}
    >
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

function wasteTypeLabel(wasteType: RegionalWasteType): string {
  return { general: "생활폐기물", food: "음식물", recyclable: "재활용" }[
    wasteType
  ];
}

function failureLabel(reason: RegionalGuideFailureReason): string {
  return {
    configuration: "설정",
    timeout: "시간 초과",
    network: "네트워크",
    api: "API",
    unknown: "알 수 없는 오류",
  }[reason];
}

function failureDescription(reason: RegionalGuideFailureReason): string {
  if (reason === "configuration") return "지역 가이드 API 설정을 확인해주세요.";
  if (reason === "network")
    return "네트워크 연결을 확인한 뒤 다시 시도해주세요.";
  if (reason === "timeout")
    return "조회 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.";
  return "잠시 후 다시 시도해주세요.";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { padding: 20, paddingBottom: 36 },
  header: { marginBottom: 28, paddingTop: 12 },
  title: {
    color: "#172018",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: { color: "#59615A", fontSize: 15, lineHeight: 22 },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: { color: "#172018", fontSize: 19, fontWeight: "800" },
  linkText: { color: "#2E7D32", fontSize: 14, fontWeight: "800" },
  card: {
    backgroundColor: "#FFF5D3",
    borderColor: "#F1DF9E",
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    minHeight: 150,
    padding: 20,
  },
  summaryCard: {
    backgroundColor: "#FFE9A6",
    borderRadius: 16,
    gap: 16,
    padding: 20,
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardHeaderText: { flex: 1, paddingRight: 12 },
  guideLabel: {
    color: "#174C1C",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 16,
  },
  regionName: {
    color: "#174C1C",
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 25,
  },
  stateTitle: { color: "#172018", fontSize: 17, fontWeight: "800" },
  stateDescription: { color: "#697069", fontSize: 14, lineHeight: 20 },
  summaryTiles: {
    flexDirection: "row",
    gap: 12,
  },
  summaryTile: {
    backgroundColor: "#FFF9E8",
    borderRadius: 14,
    flex: 1,
    minHeight: 96,
    padding: 14,
  },
  summaryTileLabel: {
    color: "#2E8B35",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },
  summaryTileValue: {
    color: "#171A17",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
  summaryFooter: { color: "#174C1C", fontSize: 14, lineHeight: 21 },
  notice: { color: "#8A5A13", fontSize: 12, lineHeight: 18 },
  refreshError: {
    alignItems: "center",
    backgroundColor: "#FFF8E8",
    borderRadius: 10,
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    padding: 10,
  },
  actionButton: {
    alignSelf: "flex-start",
    backgroundColor: "#2E7D32",
    borderRadius: 10,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
