import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import type { RegionalGuideApiClient } from "../../regional-guide/data/regionalGuideApi";
import { findRegions } from "../../regional-guide/data/regionRepository";
import { createRegionalGuideId } from "../../regional-guide/domain/RegionalGuideFavorite";
import type { HomeRegionalGuideRepresentativeController } from "../../regional-guide/presentation/useHomeRegionalGuideRepresentative";
import type { RegionalGuideFavoritesController } from "../../regional-guide/presentation/useRegionalGuideFavorites";
import { HomeScreen } from "./HomeScreen";

const regionalGuideId = gangneungGuideId();
describe("HomeScreen", () => {
  it("대표 지역 요약을 표시하고 같은 지역 상세로 연결한다", async () => {
    const guide = {
      sidoName: "강원특별자치도",
      sigunguName: "강릉시",
      targetRegionName: "강남동",
      schedules: [{ wasteType: "general" as const, disposalDays: "월" }],
    };
    const onOpenDetail = jest.fn();
    render(
      <HomeScreen
        active
        apiClient={clientWith({ status: "success", guides: [guide] })}
        favorites={favoriteController([regionalGuideId])}
        onOpenDetail={onOpenDetail}
        onOpenGuide={jest.fn()}
        onOpenSaved={jest.fn()}
        representative={representativeController(regionalGuideId)}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText("홈 대표 지역 배출 안내")).toBeOnTheScreen(),
    );
    expect(screen.getByText(/생활폐기물 기준입니다/)).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText("대표 지역 배출 안내 상세 열기"));
    expect(onOpenDetail).toHaveBeenCalledWith(regionalGuideId, guide);
  });

  it("대표 지역이 없으면 지역 가이드 선택 흐름을 안내한다", () => {
    const onOpenGuide = jest.fn();
    render(
      <HomeScreen
        active
        apiClient={clientWith({ status: "not-found" })}
        favorites={favoriteController([])}
        onOpenDetail={jest.fn()}
        onOpenGuide={onOpenGuide}
        onOpenSaved={jest.fn()}
        representative={representativeController(undefined)}
      />,
    );

    expect(screen.getByLabelText("홈 대표 지역 없음")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("지역 가이드로 이동"));
    expect(onOpenGuide).toHaveBeenCalledTimes(1);
  });

  it("Favorite은 있지만 고정하지 않았으면 저장 탭으로 안내한다", () => {
    const onOpenSaved = jest.fn();
    render(
      <HomeScreen
        active
        apiClient={clientWith({ status: "not-found" })}
        favorites={favoriteController([regionalGuideId])}
        onOpenDetail={jest.fn()}
        onOpenGuide={jest.fn()}
        onOpenSaved={onOpenSaved}
        representative={representativeController(undefined)}
      />,
    );

    expect(screen.getByLabelText("홈 대표 지역 없음")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("저장한 지역에서 고정"));
    expect(onOpenSaved).toHaveBeenCalledTimes(1);
  });
});

function clientWith(
  result: Awaited<
    ReturnType<RegionalGuideApiClient["fetchRegionalDisposalGuides"]>
  >,
): RegionalGuideApiClient {
  return { fetchRegionalDisposalGuides: jest.fn().mockResolvedValue(result) };
}

function favoriteController(
  guideIds: ReturnType<typeof gangneungGuideId>[],
): RegionalGuideFavoritesController {
  return {
    state: { status: "ready", guideIds, isPersisting: false },
    toggle: jest.fn(),
    isFavorite: (guideId) => guideIds.includes(guideId),
  };
}

function representativeController(
  guideId: ReturnType<typeof gangneungGuideId> | undefined,
): HomeRegionalGuideRepresentativeController {
  return {
    state: { status: "ready", guideId, isPersisting: false },
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
  const guideId = createRegionalGuideId({ sido, sigungu, eupmyeondong });
  if (!guideId) throw new Error("테스트 지역 식별자가 필요합니다.");
  return guideId;
}
