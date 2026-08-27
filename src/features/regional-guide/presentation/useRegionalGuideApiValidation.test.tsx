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
      void result.current.validate("제주시");
    });
    await act(async () => {
      await result.current.validate("서귀포시");
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
      await result.current.validate("제주시");
    });

    expect(result.current.state).toEqual({ status: "idle" });
  });
});
