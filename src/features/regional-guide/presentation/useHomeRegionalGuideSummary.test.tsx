import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

import type { RegionalGuideApiClient } from "../data/regionalGuideApi";
import { findRegions } from "../data/regionRepository";
import {
  createRegionalGuideId,
  type RegionalGuideId,
} from "../domain/RegionalGuideFavorite";
import type { RegionalGuideLookupResult } from "../domain/RegionalDisposalGuide";
import { useHomeRegionalGuideSummary } from "./useHomeRegionalGuideSummary";

describe("useHomeRegionalGuideSummary", () => {
  it("대표 지역 최신 데이터를 홈 요약 ready 상태로 변환한다", async () => {
    const client = createClient({
      status: "success",
      guides: [gangneungGuide()],
    });
    const { result } = renderHook(() =>
      useHomeRegionalGuideSummary(gangneungGuideId(), client),
    );

    expect(result.current.state.status).toBe("loading");
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    expect(result.current.state).toMatchObject({
      status: "ready",
      summary: {
        regionName: "강원특별자치도 > 강릉시 > 강남동",
        schedules: [{ wasteType: "general", disposalDays: "월, 수" }],
      },
      isRefreshing: false,
    });
  });

  it.each([
    [{ status: "not-found" } as const, "not-found"],
    [
      {
        status: "success",
        guides: [{ targetRegionName: "교1동", schedules: [] }],
      } as const,
      "not-provided",
    ],
    [{ status: "failure", reason: "network" } as const, "failure"],
  ])("결과 없음·지역 미제공·실패를 구분한다", async (response, status) => {
    const client = createClient(response as RegionalGuideLookupResult);
    const { result } = renderHook(() =>
      useHomeRegionalGuideSummary(gangneungGuideId(), client),
    );

    await waitFor(() => expect(result.current.state.status).toBe(status));
  });

  it("정상 요약이 있으면 재조회 실패 중에도 이전 결과를 유지한다", async () => {
    const client: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest
        .fn()
        .mockResolvedValueOnce({
          status: "success",
          guides: [gangneungGuide()],
        })
        .mockResolvedValueOnce({ status: "failure", reason: "network" }),
      clearCache: jest.fn(),
    };
    const { result } = renderHook(() =>
      useHomeRegionalGuideSummary(gangneungGuideId(), client),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.state).toMatchObject({
      status: "ready",
      summary: { regionName: "강원특별자치도 > 강릉시 > 강남동" },
      isRefreshing: false,
      refreshError: "network",
    });
    expect(client.clearCache).toHaveBeenCalledWith("강릉시");
  });

  it("대표 Favorite가 없어지면 진행 중인 결과가 홈 상태를 덮어쓰지 않는다", async () => {
    const request = deferredResult();
    const client: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest.fn(() => request.promise),
    };
    const { result, rerender } = renderHook(
      ({ guideId }: { guideId: RegionalGuideId | undefined }) =>
        useHomeRegionalGuideSummary(guideId, client),
      {
        initialProps: { guideId: gangneungGuideId() } as {
          guideId: RegionalGuideId | undefined;
        },
      },
    );

    rerender({ guideId: undefined });
    expect(result.current.state.status).toBe("no-representative");

    await act(async () => {
      request.resolve({ status: "success", guides: [gangneungGuide()] });
      await request.promise;
    });
    expect(result.current.state.status).toBe("no-representative");
  });

  it("foreground 복귀 시 API 캐시를 비우고 같은 대표 지역을 갱신한다", async () => {
    let appStateListener: ((state: AppStateStatus) => void) | undefined;
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_, listener) => {
        appStateListener = listener;
        return { remove: jest.fn() };
      });
    const client = createClient({
      status: "success",
      guides: [gangneungGuide()],
    });
    client.clearCache = jest.fn();
    renderHook(() => useHomeRegionalGuideSummary(gangneungGuideId(), client));
    await waitFor(() =>
      expect(client.fetchRegionalDisposalGuides).toHaveBeenCalledTimes(1),
    );

    await act(async () => {
      appStateListener?.("active");
    });

    await waitFor(() =>
      expect(client.fetchRegionalDisposalGuides).toHaveBeenCalledTimes(2),
    );
    expect(client.clearCache).toHaveBeenCalledWith("강릉시");
  });
});

function createClient(
  result: RegionalGuideLookupResult,
): RegionalGuideApiClient {
  return { fetchRegionalDisposalGuides: jest.fn().mockResolvedValue(result) };
}

function gangneungGuide() {
  return {
    sidoName: "강원특별자치도",
    sigunguName: "강릉시",
    targetRegionName: "강남동",
    schedules: [{ wasteType: "general" as const, disposalDays: "월, 수" }],
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

function deferredResult() {
  let resolve!: (result: RegionalGuideLookupResult) => void;
  const promise = new Promise<RegionalGuideLookupResult>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
