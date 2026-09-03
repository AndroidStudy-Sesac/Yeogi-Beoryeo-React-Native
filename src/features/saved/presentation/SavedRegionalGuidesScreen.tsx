import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  regionalGuideSelectionPath,
  resolveRegionalGuideSelection,
} from "../../regional-guide/data/regionalGuideSelection";
import type { RegionalGuideId } from "../../regional-guide/domain/RegionalGuideFavorite";
import type { HomeRegionalGuideRepresentativeController } from "../../regional-guide/presentation/useHomeRegionalGuideRepresentative";
import type { RegionalGuideFavoritesController } from "../../regional-guide/presentation/useRegionalGuideFavorites";

interface SavedRegionalGuidesScreenProps {
  favorites: RegionalGuideFavoritesController;
  representative: HomeRegionalGuideRepresentativeController;
  onOpenGuide: () => void;
  onOpenDetail: (guideId: RegionalGuideId) => void;
}

export function SavedRegionalGuidesScreen({
  favorites,
  representative,
  onOpenGuide,
  onOpenDetail,
}: SavedRegionalGuidesScreenProps) {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>즐겨찾기</Text>
      </View>
      <View accessibilityRole="tablist" style={styles.categoryTabs}>
        <CategoryTab label="품목" />
        <CategoryTab label="장소" />
        <CategoryTab label="지역" selected />
      </View>

      {favorites.state.status === "restoring" ? (
        <View
          accessibilityLabel="지역 즐겨찾기 복원 중"
          style={styles.centerState}
        >
          <ActivityIndicator color="#2E8B35" />
          <Text style={styles.stateText}>저장한 지역을 불러오는 중입니다.</Text>
        </View>
      ) : favorites.state.guideIds.length === 0 ? (
        <View accessibilityLabel="저장한 지역 없음" style={styles.centerState}>
          <Text style={styles.stateTitle}>저장한 지역이 없습니다.</Text>
          <Text style={styles.stateText}>
            안내 탭에서 지역을 조회하고 별을 눌러 저장해주세요.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenGuide}
            style={styles.actionButton}
          >
            <Text style={styles.actionButtonText}>지역 가이드로 이동</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          accessibilityLabel="지역 즐겨찾기 목록"
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.helperText}>
            핀으로 고정한 한 지역의 배출 안내가 홈에 표시됩니다.
          </Text>
          {favorites.state.guideIds.map((guideId) => {
            const selection = resolveRegionalGuideSelection(guideId);
            if (!selection) return null;
            const path = regionalGuideSelectionPath(selection);
            const isRepresentative =
              representative.state.status === "ready" &&
              representative.state.guideId === guideId;
            return (
              <Pressable
                key={guideId}
                accessibilityLabel={`저장한 지역 상세: ${path}`}
                accessibilityRole="button"
                onPress={() => onOpenDetail(guideId)}
                style={styles.card}
              >
                <View style={styles.cardContent}>
                  <Text numberOfLines={1} style={styles.regionPath}>
                    {path}
                  </Text>
                  <View style={styles.regionTag}>
                    <Text numberOfLines={1} style={styles.regionTagText}>
                      {selection.eupmyeondong?.name ??
                        selection.sigungu?.name ??
                        "지역별 배출 안내"}
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityLabel={
                    isRepresentative
                      ? `대표 지역 고정 해제: ${path}`
                      : `대표 지역 고정: ${path}`
                  }
                  accessibilityRole="button"
                  accessibilityState={{ selected: isRepresentative }}
                  disabled={representative.state.status !== "ready"}
                  hitSlop={8}
                  onPress={(event) => {
                    event?.stopPropagation();
                    if (isRepresentative) representative.clear();
                    else representative.select(guideId);
                  }}
                  style={styles.iconButton}
                >
                  <Text
                    style={[
                      styles.pinIcon,
                      isRepresentative && styles.selectedPinIcon,
                    ]}
                  >
                    ⚑
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`지역 가이드 즐겨찾기 해제: ${path}`}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={(event) => {
                    event?.stopPropagation();
                    favorites.toggle(guideId);
                  }}
                  style={styles.iconButton}
                >
                  <Text style={styles.favoriteIcon}>★</Text>
                </Pressable>
              </Pressable>
            );
          })}
          {favorites.state.persistenceError ? (
            <Text style={styles.errorText}>
              즐겨찾기 저장에 실패해 마지막 정상 상태로 복원했습니다.
            </Text>
          ) : null}
          {representative.state.status === "ready" &&
          representative.state.persistenceError ? (
            <Text style={styles.errorText}>
              대표 지역 저장에 실패해 마지막 정상 상태를 유지합니다.
            </Text>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function CategoryTab({
  label,
  selected = false,
}: {
  label: string;
  selected?: boolean;
}) {
  return (
    <View
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      style={styles.categoryTab}
    >
      <Text
        style={[styles.categoryLabel, selected && styles.selectedCategoryLabel]}
      >
        {label}
      </Text>
      {selected ? <View style={styles.categoryIndicator} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#FFFFFF", flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 22, paddingTop: 24 },
  title: { color: "#171A17", fontSize: 30, fontWeight: "900" },
  categoryTabs: {
    borderBottomColor: "#DCE4DA",
    borderBottomWidth: 1,
    flexDirection: "row",
    marginHorizontal: 20,
  },
  categoryTab: { alignItems: "center", flex: 1, minHeight: 48 },
  categoryLabel: { color: "#687068", fontSize: 16, fontWeight: "700" },
  selectedCategoryLabel: { color: "#2E8B35" },
  categoryIndicator: {
    backgroundColor: "#2E8B35",
    borderRadius: 2,
    bottom: 0,
    height: 3,
    position: "absolute",
    width: 28,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 32,
  },
  stateTitle: { color: "#1E221E", fontSize: 18, fontWeight: "800" },
  stateText: {
    color: "#697069",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  actionButton: {
    backgroundColor: "#2E8B35",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  actionButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  list: { gap: 14, padding: 20, paddingBottom: 36 },
  helperText: {
    color: "#697069",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 2,
  },
  card: {
    alignItems: "center",
    borderColor: "#D9E3D7",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 118,
    padding: 18,
  },
  cardContent: { flex: 1, gap: 12, paddingRight: 8 },
  regionPath: { color: "#171A17", fontSize: 18, fontWeight: "900" },
  regionTag: {
    alignSelf: "flex-start",
    backgroundColor: "#E7F4DE",
    borderRadius: 10,
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  regionTagText: { color: "#244E22", fontSize: 14, fontWeight: "700" },
  iconButton: { alignItems: "center", justifyContent: "center", padding: 8 },
  pinIcon: { color: "#7D837D", fontSize: 27 },
  selectedPinIcon: { color: "#2E8B35" },
  favoriteIcon: { color: "#F6A313", fontSize: 28 },
  errorText: { color: "#A23B32", fontSize: 13, lineHeight: 19 },
});
