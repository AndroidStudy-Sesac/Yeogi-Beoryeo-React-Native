import { act, renderHook } from "@testing-library/react-native";

import type { RegionalGuideApiClient } from "../data/regionalGuideApi";
import type { RegionalGuideLookupResult } from "../domain/RegionalDisposalGuide";
import { useRegionalGuideApiValidation } from "./useRegionalGuideApiValidation";

describe("useRegionalGuideApiValidation", () => {
  it("최신 요청을 시작하면 이전 요청을 취소하고 최신 결과만 표시한다", async () => {
    let firstRequestSignal: AbortSignal | undefined;
    const client: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest.fn((sigunguName, signal) => {
        if (sigunguName === "제주시") {
          firstRequestSignal = signal;
          return new Promise(() => undefined);
        }

        return Promise.resolve({
          status: "success",
          guides: [{ sigunguName: "서귀포시", schedules: [] }],
        });
      }),
    };
    const { result } = renderHook(() => useRegionalGuideApiValidation(client));

    await act(async () => {
      void result.current.validate({ sigunguName: "제주시" });
    });
    await act(async () => {
      await result.current.validate({ sigunguName: "서귀포시" });
    });

    expect(firstRequestSignal?.aborted).toBe(true);
    expect(result.current.state).toEqual({
      status: "success",
      guide: { sigunguName: "서귀포시", schedules: [] },
    });
  });

  it("취소 예외는 일반 오류 상태로 표시하지 않는다", async () => {
    const abortError = new Error("cancelled");
    abortError.name = "AbortError";
    const client: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest.fn().mockRejectedValue(abortError),
    };
    const { result } = renderHook(() => useRegionalGuideApiValidation(client));

    await act(async () => {
      await result.current.validate({ sigunguName: "제주시" });
    });

    expect(result.current.state).toEqual({ status: "idle" });
  });

  it("후속 페이지 실패에서 받은 정상 가이드를 partial 상태로 유지한다", async () => {
    const client: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest.fn().mockResolvedValue({
        status: "partial",
        guides: [{ targetRegionName: "노형동", schedules: [] }],
        metadata: {
          reason: "network",
          fetchedPageCount: 1,
          receivedItemCount: 1,
          totalCount: 2,
          failedPageNo: 2,
          duplicateGuideCount: 0,
        },
      }),
    };
    const { result } = renderHook(() => useRegionalGuideApiValidation(client));

    await act(async () => {
      await result.current.validate({
        sigunguName: "제주시",
        eupmyeondongName: "노형동",
      });
    });

    expect(result.current.state).toMatchObject({
      status: "partial",
      guide: { targetRegionName: "노형동" },
      metadata: { reason: "network", failedPageNo: 2 },
    });
  });

  it("취소된 이전 요청의 늦은 partial result가 최신 결과를 덮어쓰지 않는다", async () => {
    const firstRequest = deferredResult();
    const client: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest.fn((sigunguName) =>
        sigunguName === "제주시"
          ? firstRequest.promise
          : Promise.resolve({
              status: "success",
              guides: [{ sigunguName: "서귀포시", schedules: [] }],
            }),
      ),
    };
    const { result } = renderHook(() => useRegionalGuideApiValidation(client));

    await act(async () => {
      void result.current.validate({ sigunguName: "제주시" });
    });
    await act(async () => {
      await result.current.validate({ sigunguName: "서귀포시" });
    });
    await act(async () => {
      firstRequest.resolve({
        status: "partial",
        guides: [{ sigunguName: "제주시", schedules: [] }],
        metadata: {
          reason: "timeout",
          fetchedPageCount: 1,
          receivedItemCount: 1,
          totalCount: 2,
          failedPageNo: 2,
          duplicateGuideCount: 0,
        },
      });
      await firstRequest.promise;
    });

    expect(result.current.state).toEqual({
      status: "success",
      guide: { sigunguName: "서귀포시", schedules: [] },
    });
  });

  it("조회 결과에 선택한 읍면동 안내가 없으면 미제공 상태로 구분한다", async () => {
    const client: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest.fn().mockResolvedValue({
        status: "success",
        guides: [{ targetRegionName: "연동", schedules: [] }],
      }),
    };
    const { result } = renderHook(() => useRegionalGuideApiValidation(client));

    await act(async () => {
      await result.current.validate({
        sigunguName: "제주시",
        eupmyeondongName: "노형동",
      });
    });

    expect(result.current.state).toEqual({ status: "not-provided" });
  });

  it("실패한 마지막 조회 조건으로 다시 조회한다", async () => {
    const client: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest
        .fn()
        .mockResolvedValueOnce({ status: "failure", reason: "network" })
        .mockResolvedValueOnce({
          status: "success",
          guides: [{ targetRegionName: "동지역", schedules: [] }],
        }),
    };
    const { result } = renderHook(() => useRegionalGuideApiValidation(client));

    await act(async () => {
      await result.current.validate({
        sigunguName: "제주시",
        eupmyeondongName: "노형동",
      });
    });
    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.state.status).toBe("success");
    expect(client.fetchRegionalDisposalGuides).toHaveBeenCalledTimes(2);
  });

  it("partial result도 마지막 조회 조건을 유지해 다시 조회한다", async () => {
    const client: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest
        .fn()
        .mockResolvedValueOnce({
          status: "partial",
          guides: [{ targetRegionName: "노형동", schedules: [] }],
          metadata: {
            reason: "api",
            fetchedPageCount: 1,
            receivedItemCount: 1,
            totalCount: 2,
            failedPageNo: 2,
            duplicateGuideCount: 0,
          },
        })
        .mockResolvedValueOnce({
          status: "success",
          guides: [{ targetRegionName: "노형동", schedules: [] }],
        }),
    };
    const { result } = renderHook(() => useRegionalGuideApiValidation(client));
    const request = {
      sigunguName: "제주시",
      eupmyeondongName: "노형동",
    };

    await act(async () => {
      await result.current.validate(request);
    });
    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.state.status).toBe("success");
    expect(client.fetchRegionalDisposalGuides).toHaveBeenNthCalledWith(
      2,
      "제주시",
      expect.any(AbortSignal),
    );
  });
});

function deferredResult() {
  let resolve!: (result: RegionalGuideLookupResult) => void;
  const promise = new Promise<RegionalGuideLookupResult>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}
