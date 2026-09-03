import { fireEvent, render, screen } from "@testing-library/react-native";

import { findRegions } from "../../regional-guide/data/regionRepository";
import { createRegionalGuideId } from "../../regional-guide/domain/RegionalGuideFavorite";
import type { HomeRegionalGuideRepresentativeController } from "../../regional-guide/presentation/useHomeRegionalGuideRepresentative";
import type { RegionalGuideFavoritesController } from "../../regional-guide/presentation/useRegionalGuideFavorites";
import { SavedRegionalGuidesScreen } from "./SavedRegionalGuidesScreen";

const guideId = gangneungGuideId();

describe("SavedRegionalGuidesScreen", () => {
  it("지역 Favorite 목록에서 홈 대표 지역을 고정한다", () => {
    const representative = representativeController(undefined);
    render(
      <SavedRegionalGuidesScreen
        favorites={favoriteController([guideId])}
        onOpenDetail={jest.fn()}
        onOpenGuide={jest.fn()}
        representative={representative}
      />,
    );

    expect(screen.getByLabelText("지역 즐겨찾기 목록")).toBeOnTheScreen();
    fireEvent.press(
      screen.getByLabelText("대표 지역 고정: 강원특별자치도 > 강릉시 > 강남동"),
    );

    expect(representative.select).toHaveBeenCalledWith(guideId);
  });

  it("저장한 지역의 상세 이동과 Favorite 해제를 제공한다", () => {
    const favorites = favoriteController([guideId]);
    const representative = representativeController(guideId);
    const onOpenDetail = jest.fn();
    render(
      <SavedRegionalGuidesScreen
        favorites={favorites}
        onOpenDetail={onOpenDetail}
        onOpenGuide={jest.fn()}
        representative={representative}
      />,
    );

    expect(
      screen.getByLabelText(
        "대표 지역 고정 해제: 강원특별자치도 > 강릉시 > 강남동",
      ),
    ).toBeOnTheScreen();
    fireEvent.press(
      screen.getByLabelText(
        "대표 지역 고정 해제: 강원특별자치도 > 강릉시 > 강남동",
      ),
    );
    expect(representative.clear).toHaveBeenCalledTimes(1);

    fireEvent.press(
      screen.getByLabelText(
        "저장한 지역 상세: 강원특별자치도 > 강릉시 > 강남동",
      ),
    );
    expect(onOpenDetail).toHaveBeenCalledWith(guideId);

    fireEvent.press(
      screen.getByLabelText(
        "지역 가이드 즐겨찾기 해제: 강원특별자치도 > 강릉시 > 강남동",
      ),
    );
    expect(favorites.toggle).toHaveBeenCalledWith(guideId);
  });

  it("저장한 지역이 없으면 안내 탭으로 연결한다", () => {
    const onOpenGuide = jest.fn();
    render(
      <SavedRegionalGuidesScreen
        favorites={favoriteController([])}
        onOpenDetail={jest.fn()}
        onOpenGuide={onOpenGuide}
        representative={representativeController(undefined)}
      />,
    );

    expect(screen.getByLabelText("저장한 지역 없음")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("지역 가이드로 이동"));
    expect(onOpenGuide).toHaveBeenCalledTimes(1);
  });
});

function favoriteController(
  guideIds: ReturnType<typeof gangneungGuideId>[],
): RegionalGuideFavoritesController {
  return {
    state: { status: "ready", guideIds, isPersisting: false },
    toggle: jest.fn(),
    isFavorite: (candidate) => guideIds.includes(candidate),
  };
}

function representativeController(
  selectedGuideId: ReturnType<typeof gangneungGuideId> | undefined,
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
