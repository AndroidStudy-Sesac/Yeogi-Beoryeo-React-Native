import { act, renderHook } from "@testing-library/react-native";

import type { RegionalGuideApiClient } from "../data/regionalGuideApi";
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
});
