import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import type { RegionalGuideApiClient } from "../data/regionalGuideApi";
import { RegionalGuideScreen } from "./RegionalGuideScreen";

describe("RegionalGuideScreen", () => {
  it("시도·시군구·읍면동을 각각 드롭다운으로 연다", () => {
    render(<RegionalGuideScreen regionalGuideApiClient={pendingApiClient()} />);

    expect(screen.queryByLabelText("시·도 옵션: 강원특별자치도")).toBeNull();
    expect(screen.getByLabelText("시·군·구 선택 드롭다운")).toBeDisabled();
    expect(screen.getByLabelText("읍면동 선택 드롭다운")).toBeDisabled();

    fireEvent.press(screen.getByLabelText("시·도 선택 드롭다운"));
    expect(screen.getByLabelText("시·도 옵션 목록")).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("시·도 옵션: 강원특별자치도"));
    fireEvent.press(screen.getByLabelText("시·군·구 선택 드롭다운"));

    expect(screen.getByLabelText("시·군·구 옵션: 강릉시")).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText("시·군·구 옵션: 강릉시"));
    fireEvent.press(screen.getByLabelText("읍면동 선택 드롭다운"));

    expect(screen.getByLabelText("읍면동 옵션: 강남동")).toBeOnTheScreen();
  });

  it("지역 선택 후 조회 결과를 같은 화면에 반영한다", () => {
    render(<RegionalGuideScreen regionalGuideApiClient={pendingApiClient()} />);

    selectGangneungRegion();
    fireEvent.press(screen.getByText("조회"));

    expect(
      screen.getAllByText("강원특별자치도 > 강릉시 > 강남동"),
    ).toHaveLength(2);
    expect(screen.getByText("선택한 지역")).toBeOnTheScreen();
  });

  it("상위 지역을 변경하면 하위 드롭다운 선택을 초기화한다", () => {
    render(<RegionalGuideScreen regionalGuideApiClient={pendingApiClient()} />);

    selectGangneungRegion();
    fireEvent.press(screen.getByLabelText("시·도 선택 드롭다운"));
    fireEvent.press(screen.getByLabelText("시·도 옵션: 서울특별시"));

    expect(screen.getByText("시·군·구 선택")).toBeOnTheScreen();
    expect(screen.getByLabelText("읍면동 선택 드롭다운")).toBeDisabled();

    fireEvent.press(screen.getByLabelText("시·군·구 선택 드롭다운"));
    fireEvent.press(screen.getByLabelText("시·군·구 옵션: 강남구"));
    fireEvent.press(screen.getByLabelText("읍면동 선택 드롭다운"));

    expect(screen.queryByLabelText("읍면동 옵션: 강남동")).toBeNull();
    expect(screen.getByLabelText("읍면동 옵션: 개포1동")).toBeOnTheScreen();
  });

  it("조회한 시군구의 API 매핑 결과를 검증 패널에 표시한다", async () => {
    const client: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest.fn().mockResolvedValue({
        status: "success",
        guides: [
          {
            sidoName: "강원특별자치도",
            sigunguName: "강릉시",
            targetRegionName: "강남동",
            schedules: [{ wasteType: "general", disposalDays: "월" }],
          },
        ],
      }),
    };
    render(<RegionalGuideScreen regionalGuideApiClient={client} />);

    selectGangneungRegion();
    fireEvent.press(screen.getByText("조회"));

    await waitFor(() => {
      expect(screen.getByText("API 검증 성공")).toBeOnTheScreen();
    });
    expect(
      screen.getByText(/강릉시 > 강남동 · 생활폐기물 월/),
    ).toBeOnTheScreen();
    expect(client.fetchRegionalDisposalGuides).toHaveBeenCalledWith(
      "강릉시",
      expect.any(AbortSignal),
    );
  });

  it("API 결과 없음과 네트워크 오류를 각각 표시한다", async () => {
    const notFoundClient: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest.fn().mockResolvedValue({
        status: "not-found",
      }),
    };
    const { rerender } = render(
      <RegionalGuideScreen regionalGuideApiClient={notFoundClient} />,
    );

    selectGangneungRegion();
    fireEvent.press(screen.getByText("조회"));
    await waitFor(() => {
      expect(screen.getByText("조회 결과가 없습니다.")).toBeOnTheScreen();
    });

    const networkFailureClient: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest.fn().mockResolvedValue({
        status: "failure",
        reason: "network",
      }),
    };
    rerender(
      <RegionalGuideScreen regionalGuideApiClient={networkFailureClient} />,
    );

    selectGangneungRegion();
    fireEvent.press(screen.getByText("조회"));
    await waitFor(() => {
      expect(
        screen.getByText("API 검증 실패: 네트워크 오류"),
      ).toBeOnTheScreen();
    });
  });
});

function pendingApiClient(): RegionalGuideApiClient {
  return {
    fetchRegionalDisposalGuides: jest.fn(() => new Promise(() => undefined)),
  };
}

function selectGangneungRegion() {
  fireEvent.press(screen.getByLabelText("시·도 선택 드롭다운"));
  fireEvent.press(screen.getByLabelText("시·도 옵션: 강원특별자치도"));
  fireEvent.press(screen.getByLabelText("시·군·구 선택 드롭다운"));
  fireEvent.press(screen.getByLabelText("시·군·구 옵션: 강릉시"));
  fireEvent.press(screen.getByLabelText("읍면동 선택 드롭다운"));
  fireEvent.press(screen.getByLabelText("읍면동 옵션: 강남동"));
}
