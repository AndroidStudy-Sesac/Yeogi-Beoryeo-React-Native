import { useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  BottomNavigation,
  type AppTab,
} from "./src/core/navigation/BottomNavigation";
import { HomeScreen } from "./src/features/home/presentation/HomeScreen";
import { createAsyncStorageHomeRegionalGuideRepresentativeRepository } from "./src/features/regional-guide/data/homeRegionalGuideRepresentativeStorage";
import { createRegionalGuideApiClient } from "./src/features/regional-guide/data/regionalGuideApi";
import { createAsyncStorageRegionalGuideFavoriteRepository } from "./src/features/regional-guide/data/regionalGuideFavoriteStorage";
import type { RegionalDisposalGuide } from "./src/features/regional-guide/domain/RegionalDisposalGuide";
import type { RegionalGuideId } from "./src/features/regional-guide/domain/RegionalGuideFavorite";
import { RegionalGuideScreen } from "./src/features/regional-guide/presentation/RegionalGuideScreen";
import { useHomeRegionalGuideRepresentative } from "./src/features/regional-guide/presentation/useHomeRegionalGuideRepresentative";
import type { HomeRegionalGuideRepresentativeController } from "./src/features/regional-guide/presentation/useHomeRegionalGuideRepresentative";
import { useRegionalGuideFavorites } from "./src/features/regional-guide/presentation/useRegionalGuideFavorites";
import type { RegionalGuideFavoritesController } from "./src/features/regional-guide/presentation/useRegionalGuideFavorites";
import { SavedRegionalGuidesScreen } from "./src/features/saved/presentation/SavedRegionalGuidesScreen";

interface RegionalGuideRoute {
  guideId?: RegionalGuideId;
  guide?: RegionalDisposalGuide;
}

export default function App() {
  const apiClient = useMemo(() => createRegionalGuideApiClient(), []);
  const favoriteRepository = useMemo(
    () => createAsyncStorageRegionalGuideFavoriteRepository(),
    [],
  );
  const representativeRepository = useMemo(
    () => createAsyncStorageHomeRegionalGuideRepresentativeRepository(),
    [],
  );
  const favorites = useRegionalGuideFavorites(favoriteRepository);
  const representative = useHomeRegionalGuideRepresentative(
    favorites.state,
    representativeRepository,
  );

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppContent
        apiClient={apiClient}
        favorites={favorites}
        representative={representative}
      />
    </SafeAreaProvider>
  );
}

interface AppContentProps {
  apiClient: ReturnType<typeof createRegionalGuideApiClient>;
  favorites: RegionalGuideFavoritesController;
  representative: HomeRegionalGuideRepresentativeController;
}

export function AppContent({
  apiClient,
  favorites,
  representative,
}: AppContentProps) {
  const [selectedTab, setSelectedTab] = useState<AppTab>("home");
  const [regionalGuideRoute, setRegionalGuideRoute] =
    useState<RegionalGuideRoute>();
  const closeRegionalGuide = () => setRegionalGuideRoute(undefined);

  useEffect(() => {
    if (!regionalGuideRoute) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        closeRegionalGuide();
        return true;
      },
    );
    return () => subscription.remove();
  }, [regionalGuideRoute]);

  const swipeBackResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          shouldStartBackSwipe(gesture.x0, gesture.dx, gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          if (shouldCompleteBackSwipe(gesture.dx)) closeRegionalGuide();
        },
      }),
    [],
  );

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View
          pointerEvents={selectedTab === "home" ? "auto" : "none"}
          style={[
            styles.tabScreen,
            selectedTab !== "home" && styles.hiddenTabScreen,
          ]}
        >
          <HomeScreen
            active={selectedTab === "home" && !regionalGuideRoute}
            apiClient={apiClient}
            favorites={favorites}
            representative={representative}
            onOpenDetail={(guideId, guide) =>
              setRegionalGuideRoute({ guideId, guide })
            }
            onOpenGuide={() => setSelectedTab("guide")}
            onOpenSaved={() => setSelectedTab("saved")}
          />
        </View>
        <View
          pointerEvents={selectedTab === "map" ? "auto" : "none"}
          style={[
            styles.tabScreen,
            selectedTab !== "map" && styles.hiddenTabScreen,
          ]}
        >
          <View style={styles.placeholderScreen}>
            <Text style={styles.placeholderTitle}>지도</Text>
            <Text style={styles.placeholderText}>
              지도 기능은 이번 Spike 범위에 포함되지 않습니다.
            </Text>
          </View>
        </View>
        <View
          pointerEvents={selectedTab === "guide" ? "auto" : "none"}
          style={[
            styles.tabScreen,
            selectedTab !== "guide" && styles.hiddenTabScreen,
          ]}
        >
          <RegionalGuideScreen
            favoriteController={favorites}
            regionalGuideApiClient={apiClient}
          />
        </View>
        <View
          pointerEvents={selectedTab === "saved" ? "auto" : "none"}
          style={[
            styles.tabScreen,
            selectedTab !== "saved" && styles.hiddenTabScreen,
          ]}
        >
          <SavedRegionalGuidesScreen
            favorites={favorites}
            onOpenDetail={(guideId) => setRegionalGuideRoute({ guideId })}
            onOpenGuide={() => setSelectedTab("guide")}
            representative={representative}
          />
        </View>
      </View>
      <BottomNavigation selectedTab={selectedTab} onSelect={setSelectedTab} />
      {regionalGuideRoute ? (
        <View
          accessibilityLabel="지역 가이드 상세 화면"
          {...swipeBackResponder.panHandlers}
          style={styles.detailOverlay}
        >
          <RegionalGuideScreen
            favoriteController={favorites}
            initialGuide={regionalGuideRoute.guide}
            initialGuideId={regionalGuideRoute.guideId}
            onBack={closeRegionalGuide}
            regionalGuideApiClient={apiClient}
          />
        </View>
      ) : null}
    </View>
  );
}

export function shouldStartBackSwipe(
  startX: number,
  deltaX: number,
  deltaY: number,
): boolean {
  return startX <= 32 && deltaX > 12 && Math.abs(deltaX) > Math.abs(deltaY);
}

export function shouldCompleteBackSwipe(deltaX: number): boolean {
  return deltaX >= 80;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  tabScreen: { flex: 1 },
  hiddenTabScreen: { display: "none" },
  placeholderScreen: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    justifyContent: "center",
    padding: 32,
  },
  placeholderTitle: {
    color: "#171A17",
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 12,
  },
  placeholderText: { color: "#697069", fontSize: 15, lineHeight: 22 },
  detailOverlay: {
    backgroundColor: "#FFFFFF",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
});
