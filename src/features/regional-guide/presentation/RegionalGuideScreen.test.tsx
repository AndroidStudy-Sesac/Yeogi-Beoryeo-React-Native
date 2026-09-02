import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import type { RegionalGuideApiClient } from "../data/regionalGuideApi";
import type { RegionalGuideFavoriteRepository } from "../data/regionalGuideFavoriteRepository";
import { findRegions } from "../data/regionRepository";
import type { RegionSearchClient } from "../data/regionSearchClient";
import { createRegionalGuideId } from "../domain/RegionalGuideFavorite";
import type { RegionalGuideLookupResult } from "../domain/RegionalDisposalGuide";
import type { RegionSearchCandidate } from "../domain/RegionSearchModel";
import { RegionalGuideScreen } from "./RegionalGuideScreen";

describe("RegionalGuideScreen", () => {
  it("시도·시군구·읍면동을 각각 드롭다운으로 연다", () => {
    render(
      <RegionalGuideScreen
        regionalGuideApiClient={pendingApiClient()}
        regionalGuideFavoriteRepository={pendingFavoriteRepository()}
      />,
    );

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
    render(
      <RegionalGuideScreen
        regionalGuideApiClient={pendingApiClient()}
        regionalGuideFavoriteRepository={pendingFavoriteRepository()}
      />,
    );

    selectGangneungRegion();
    fireEvent.press(screen.getByText("조회"));

    expect(
      screen.getAllByText("강원특별자치도 > 강릉시 > 강남동"),
    ).toHaveLength(2);
    expect(screen.getByText("선택한 지역")).toBeOnTheScreen();
  });

  it("상위 지역을 변경하면 하위 드롭다운 선택을 초기화한다", () => {
    render(
      <RegionalGuideScreen
        regionalGuideApiClient={pendingApiClient()}
        regionalGuideFavoriteRepository={pendingFavoriteRepository()}
      />,
    );

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
      expect(screen.getByText("배출 안내")).toBeOnTheScreen();
    });
    expect(
      screen.getByText(/강릉시 > 강남동 · 생활폐기물 월/),
    ).toBeOnTheScreen();
    expect(client.fetchRegionalDisposalGuides).toHaveBeenCalledWith(
      "강릉시",
      expect.any(AbortSignal),
    );
  });

  it("API 결과 없음과 네트워크 오류를 문구로 구분한다", async () => {
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
        screen.getByText("네트워크 오류가 발생했습니다."),
      ).toBeOnTheScreen();
    });
    expect(
      screen.getByLabelText("지역별 배출 안내 다시 조회"),
    ).toBeOnTheScreen();
  });

  it("partial result의 정상 가이드와 재조회 안내를 함께 표시한다", async () => {
    const client: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest.fn().mockResolvedValue({
        status: "partial",
        guides: [gangneungGuide()],
        metadata: {
          reason: "timeout",
          fetchedPageCount: 1,
          receivedItemCount: 1,
          totalCount: 2,
          failedPageNo: 2,
          duplicateGuideCount: 0,
        },
      }),
    };
    render(<RegionalGuideScreen regionalGuideApiClient={client} />);

    selectGangneungRegion();
    fireEvent.press(screen.getByText("조회"));

    await waitFor(() => {
      expect(
        screen.getByLabelText("지역별 배출 안내 부분 조회 성공"),
      ).toBeOnTheScreen();
    });
    expect(screen.getByText(/일부 페이지만 조회했습니다/)).toBeOnTheScreen();
    expect(
      screen.getByLabelText("지역별 배출 안내 전체 결과 다시 조회"),
    ).toBeOnTheScreen();
  });

  it("조회 중 상태와 선택 지역 안내 미제공 상태를 구분한다", async () => {
    const request = deferredApiResult();
    const client: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest.fn(() => request.promise),
    };
    render(<RegionalGuideScreen regionalGuideApiClient={client} />);

    selectGangneungRegion();
    fireEvent.press(screen.getByText("조회"));
    expect(screen.getByLabelText("지역별 배출 안내 조회 중")).toBeOnTheScreen();

    await act(async () => {
      request.resolve({
        status: "success",
        guides: [{ targetRegionName: "교1동", schedules: [] }],
      });
    });
    await waitFor(() => {
      expect(
        screen.getByLabelText("선택 지역 배출 안내 미제공"),
      ).toBeOnTheScreen();
    });
  });

  it.each([
    ["timeout" as const, "배출 안내 조회 시간이 초과되었습니다."],
    ["api" as const, "배출 안내 API 오류가 발생했습니다."],
    ["configuration" as const, "API 설정이 필요합니다."],
  ])("%s 오류 상태를 구분해 표시한다", async (reason, expectedMessage) => {
    const client: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest.fn().mockResolvedValue({
        status: "failure",
        reason,
      }),
    };
    render(<RegionalGuideScreen regionalGuideApiClient={client} />);

    selectGangneungRegion();
    fireEvent.press(screen.getByText("조회"));

    await waitFor(() => {
      expect(screen.getByText(expectedMessage)).toBeOnTheScreen();
    });
  });

  it("네트워크 오류 후 같은 지역을 다시 조회한다", async () => {
    const client: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest
        .fn()
        .mockResolvedValueOnce({ status: "failure", reason: "network" })
        .mockResolvedValueOnce({
          status: "success",
          guides: [gangneungGuide()],
        }),
    };
    render(<RegionalGuideScreen regionalGuideApiClient={client} />);

    selectGangneungRegion();
    fireEvent.press(screen.getByText("조회"));
    await waitFor(() => {
      expect(
        screen.getByLabelText("지역별 배출 안내 다시 조회"),
      ).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByLabelText("지역별 배출 안내 다시 조회"));
    await waitFor(() => {
      expect(
        screen.getByLabelText("지역별 배출 안내 조회 성공"),
      ).toBeOnTheScreen();
    });
    expect(client.fetchRegionalDisposalGuides).toHaveBeenCalledTimes(2);
  });

  it("안정된 식별자로 즐겨찾기를 추가하고 해제한다", async () => {
    const favoriteRepository = resolvedFavoriteRepository([]);
    render(
      <RegionalGuideScreen
        regionalGuideApiClient={successfulApiClient()}
        regionalGuideFavoriteRepository={favoriteRepository}
      />,
    );

    selectGangneungRegion();
    fireEvent.press(screen.getByText("조회"));
    await waitFor(() => {
      expect(
        screen.getByLabelText("지역 가이드 즐겨찾기 추가"),
      ).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByLabelText("지역 가이드 즐겨찾기 추가"));
    await waitFor(() => expect(favoriteRepository.save).toHaveBeenCalled());
    const storedGuideId = favoriteRepository.save.mock.calls[0][0][0];
    expect(storedGuideId).toMatch(/^regional-guide:v1:/);
    expect(storedGuideId).not.toBe("강남동");

    fireEvent.press(screen.getByLabelText("지역 가이드 즐겨찾기 해제"));
    await waitFor(() =>
      expect(favoriteRepository.save).toHaveBeenLastCalledWith([]),
    );
  });

  it("앱 시작 시 복원한 즐겨찾기 상태를 결과 UI에 표시한다", async () => {
    const favoriteRepository = resolvedFavoriteRepository([gangneungGuideId()]);
    render(
      <RegionalGuideScreen
        regionalGuideApiClient={successfulApiClient()}
        regionalGuideFavoriteRepository={favoriteRepository}
      />,
    );

    selectGangneungRegion();
    fireEvent.press(screen.getByText("조회"));

    await waitFor(() => {
      expect(
        screen.getByLabelText("지역 가이드 즐겨찾기 해제"),
      ).toBeOnTheScreen();
    });
  });

  it("하나의 검색 후보는 선택 지역으로 연결하고 바로 안내를 조회한다", async () => {
    const apiClient = pendingApiClient();
    const searchClient: RegionSearchClient = {
      search: jest.fn().mockResolvedValue({
        status: "resolved",
        candidate: gangnamCandidate("강남구"),
      }),
    };
    render(
      <RegionalGuideScreen
        regionalGuideApiClient={apiClient}
        regionSearchClient={searchClient}
      />,
    );

    fireEvent.changeText(
      screen.getByLabelText("지역명 또는 주소 검색"),
      "서울시 강남구 테헤란로 123",
    );
    fireEvent(screen.getByLabelText("지역명 또는 주소 검색"), "submitEditing");

    await waitFor(() => {
      expect(screen.getAllByText("서울특별시 > 강남구")).toHaveLength(2);
    });
    expect(apiClient.fetchRegionalDisposalGuides).toHaveBeenCalledWith(
      "강남구",
      expect.any(AbortSignal),
    );
  });

  it("여러 검색 후보 중 선택하고 검색 결과로 돌아가 후보 상태를 복원한다", async () => {
    const candidates = [
      gangnamCandidate("역삼1동"),
      gangnamCandidate("역삼2동"),
    ];
    const searchClient: RegionSearchClient = {
      search: jest.fn().mockResolvedValue({ status: "candidates", candidates }),
    };
    render(
      <RegionalGuideScreen
        regionalGuideApiClient={pendingApiClient()}
        regionSearchClient={searchClient}
      />,
    );

    fireEvent.changeText(
      screen.getByLabelText("지역명 또는 주소 검색"),
      "역삼동",
    );
    fireEvent(screen.getByLabelText("지역명 또는 주소 검색"), "submitEditing");

    await waitFor(() => {
      expect(screen.getByText("2개의 지역 후보")).toBeOnTheScreen();
    });
    expect(screen.getByLabelText("지역 검색 후보 목록")).toBeOnTheScreen();

    fireEvent.press(
      screen.getByLabelText("지역 후보: 서울특별시 강남구 역삼2동"),
    );
    await waitFor(() => {
      expect(screen.getAllByText("서울특별시 > 강남구 > 역삼2동")).toHaveLength(
        2,
      );
    });

    fireEvent.press(screen.getByText("검색 결과로 돌아가기"));
    expect(screen.getByText("2개의 지역 후보")).toBeOnTheScreen();
    expect(
      screen.getByLabelText("지역 후보: 서울특별시 강남구 역삼1동"),
    ).toBeOnTheScreen();
  });

  it("검색 실패 후 재시도하고 검색 취소 시 빈 상태로 돌아간다", async () => {
    const searchClient: RegionSearchClient = {
      search: jest
        .fn()
        .mockRejectedValueOnce(new Error("failure"))
        .mockResolvedValueOnce({ status: "not-found" }),
    };
    render(
      <RegionalGuideScreen
        regionalGuideApiClient={pendingApiClient()}
        regionSearchClient={searchClient}
      />,
    );

    fireEvent.changeText(
      screen.getByLabelText("지역명 또는 주소 검색"),
      "없는동",
    );
    fireEvent(screen.getByLabelText("지역명 또는 주소 검색"), "submitEditing");
    await waitFor(() => {
      expect(screen.getByText("지역 검색에 실패했습니다.")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByText("다시 시도"));
    await waitFor(() => {
      expect(screen.getByText("지역 후보가 없습니다.")).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByLabelText("지역 검색 취소"));
    expect(screen.queryByText("지역 후보가 없습니다.")).toBeNull();
    expect(screen.getByLabelText("지역명 또는 주소 검색")).toHaveProp(
      "value",
      "",
    );
  });
});

function pendingApiClient(): RegionalGuideApiClient {
  return {
    fetchRegionalDisposalGuides: jest.fn(() => new Promise(() => undefined)),
  };
}

function successfulApiClient(): RegionalGuideApiClient {
  return {
    fetchRegionalDisposalGuides: jest.fn().mockResolvedValue({
      status: "success",
      guides: [gangneungGuide()],
    }),
  };
}

function gangneungGuide() {
  return {
    sidoName: "강원특별자치도",
    sigunguName: "강릉시",
    targetRegionName: "강남동",
    schedules: [{ wasteType: "general" as const, disposalDays: "월" }],
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
  if (!guideId)
    throw new Error("강릉시 강남동 가이드 식별자를 찾지 못했습니다.");
  return guideId;
}

function resolvedFavoriteRepository(
  guideIds: ReturnType<typeof gangneungGuideId>[],
) {
  return {
    restore: jest.fn().mockResolvedValue(guideIds),
    save: jest.fn().mockResolvedValue(undefined),
  } satisfies jest.Mocked<RegionalGuideFavoriteRepository>;
}

function pendingFavoriteRepository(): RegionalGuideFavoriteRepository {
  return {
    restore: jest.fn(() => new Promise(() => undefined)),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function deferredApiResult() {
  let resolve!: (result: RegionalGuideLookupResult) => void;
  const promise = new Promise<RegionalGuideLookupResult>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function selectGangneungRegion() {
  fireEvent.press(screen.getByLabelText("시·도 선택 드롭다운"));
  fireEvent.press(screen.getByLabelText("시·도 옵션: 강원특별자치도"));
  fireEvent.press(screen.getByLabelText("시·군·구 선택 드롭다운"));
  fireEvent.press(screen.getByLabelText("시·군·구 옵션: 강릉시"));
  fireEvent.press(screen.getByLabelText("읍면동 선택 드롭다운"));
  fireEvent.press(screen.getByLabelText("읍면동 옵션: 강남동"));
}

function gangnamCandidate(eupmyeondongName: string): RegionSearchCandidate {
  const sido = { id: "seoul", name: "서울특별시", level: "sido" as const };
  const sigungu = {
    id: "gangnam",
    name: "강남구",
    level: "sigungu" as const,
    parentId: sido.id,
  };
  const hasDong = eupmyeondongName.endsWith("동");
  const region = hasDong
    ? {
        sido,
        sigungu,
        eupmyeondong: {
          id: eupmyeondongName,
          name: eupmyeondongName,
          level: "eupmyeondong" as const,
          parentId: sigungu.id,
        },
      }
    : { sido, sigungu };

  return {
    id: eupmyeondongName,
    displayName: ["서울특별시", "강남구", hasDong && eupmyeondongName]
      .filter(Boolean)
      .join(" "),
    region,
  };
}
