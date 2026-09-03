import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { BackHandler } from "react-native";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import {
  AppContent,
  shouldCompleteBackSwipe,
  shouldStartBackSwipe,
} from "./App";
import type { RegionalGuideApiClient } from "./src/features/regional-guide/data/regionalGuideApi";
import { findRegions } from "./src/features/regional-guide/data/regionRepository";
import { createRegionalGuideId } from "./src/features/regional-guide/domain/RegionalGuideFavorite";
import type { HomeRegionalGuideRepresentativeController } from "./src/features/regional-guide/presentation/useHomeRegionalGuideRepresentative";
import type { RegionalGuideFavoritesController } from "./src/features/regional-guide/presentation/useRegionalGuideFavorites";

const guideId = gangneungGuideId();
const guide = {
  sidoName: "강원특별자치도",
  sigunguName: "강릉시",
  targetRegionName: "강남동",
  schedules: [{ wasteType: "general" as const, disposalDays: "월" }],
};

describe("AppContent 지역 가이드 이동", () => {
  it("홈에서 저장 탭으로 이동해 Favorite 지역을 대표로 고정한다", () => {
    const representative = representativeController(undefined);
    render(
      <AppContent
        apiClient={{
          fetchRegionalDisposalGuides: jest.fn().mockResolvedValue({
            status: "not-found",
          }),
        }}
        favorites={favoriteController()}
        representative={representative}
      />,
    );

    expect(screen.getByLabelText("홈 대표 지역 없음")).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("저장 탭"));
    fireEvent.press(
      screen.getByLabelText("대표 지역 고정: 강원특별자치도 > 강릉시 > 강남동"),
    );

    expect(representative.select).toHaveBeenCalledWith(guideId);
  });

  it("홈 정상 결과를 재사용해 상세를 열고 Android back으로 기존 홈에 돌아간다", async () => {
    let hardwareBackHandler: (() => boolean | null | undefined) | undefined;
    jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_, handler) => {
        hardwareBackHandler = handler;
        return { remove: jest.fn() };
      });
    const apiClient: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest.fn().mockResolvedValue({
        status: "success",
        guides: [guide],
      }),
    };

    render(
      <AppContent
        apiClient={apiClient}
        favorites={favoriteController()}
        representative={representativeController(guideId)}
      />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText("홈 대표 지역 배출 안내")).toBeOnTheScreen(),
    );

    fireEvent.press(screen.getByLabelText("대표 지역 배출 안내 상세 열기"));
    await waitFor(() =>
      expect(screen.getByLabelText("지역 가이드 상세 화면")).toBeOnTheScreen(),
    );
    expect(apiClient.fetchRegionalDisposalGuides).toHaveBeenCalledTimes(1);

    act(() => {
      expect(hardwareBackHandler?.()).toBe(true);
    });

    expect(screen.queryByLabelText("지역 가이드 상세 화면")).toBeNull();
    expect(screen.getByLabelText("홈 콘텐츠")).toBeOnTheScreen();
    await waitFor(() =>
      expect(apiClient.fetchRegionalDisposalGuides).toHaveBeenCalledTimes(2),
    );
  });

  it("iOS edge swipe는 왼쪽 가장자리의 충분한 오른쪽 이동만 back으로 판정한다", () => {
    expect(shouldStartBackSwipe(20, 20, 2)).toBe(true);
    expect(shouldStartBackSwipe(40, 20, 2)).toBe(false);
    expect(shouldStartBackSwipe(20, 20, 30)).toBe(false);
    expect(shouldCompleteBackSwipe(79)).toBe(false);
    expect(shouldCompleteBackSwipe(80)).toBe(true);
  });
});

function favoriteController(): RegionalGuideFavoritesController {
  return {
    state: { status: "ready", guideIds: [guideId], isPersisting: false },
    toggle: jest.fn(),
    isFavorite: (candidate) => candidate === guideId,
  };
}

function representativeController(
  selectedGuideId: typeof guideId | undefined,
): HomeRegionalGuideRepresentativeController {
  return {
    state: {
      status: "ready",
      guideId: selectedGuideId,
      isPersisting: false,
    },
    select: jest.fn(),
    clear: jest.fn(),
  };
}

function gangneungGuideId() {
  const sido = findRegions("sido").find(
    (region) => region.name === "강원특별자치도",
  );
  const sigungu = findRegions("sigungu", sido?.id).find(
    (region) => region.name === "강릉시",
  );
  const eupmyeondong = findRegions("eupmyeondong", sigungu?.id).find(
    (region) => region.name === "강남동",
  );
  const result = createRegionalGuideId({ sido, sigungu, eupmyeondong });
  if (!result) throw new Error("테스트 지역 식별자가 필요합니다.");
  return result;
}
