import { act, renderHook } from "@testing-library/react-native";

import type { RegionSearchClient } from "../data/regionSearchClient";
import type { RegionSearchCandidate } from "../domain/RegionSearchModel";
import { useRegionSearch } from "./useRegionSearch";

describe("useRegionSearch", () => {
  it("새 검색을 시작하면 이전 요청을 취소하고 최신 결과만 유지한다", async () => {
    let firstSignal: AbortSignal | undefined;
    let resolveFirst:
      | ((value: ReturnType<typeof resolvedResult>) => void)
      | undefined;
    const client: RegionSearchClient = {
      search: jest.fn((query, signal) => {
        if (query === "역삼동") {
          firstSignal = signal;
          return new Promise((resolve) => {
            resolveFirst = resolve;
          });
        }
        return Promise.resolve(resolvedResult("강남동"));
      }),
    };
    const { result } = renderHook(() => useRegionSearch(client));

    await act(async () => {
      void result.current.search("역삼동");
    });
    act(() => result.current.setQuery("강남동"));
    expect(firstSignal?.aborted).toBe(true);
    await act(async () => {
      await result.current.search("강남동");
    });

    expect(result.current.state).toMatchObject({
      status: "resolved",
      candidate: { displayName: "강남동" },
    });

    await act(async () => {
      resolveFirst?.(resolvedResult("오래된 결과"));
    });
    expect(result.current.state).toMatchObject({
      status: "resolved",
      candidate: { displayName: "강남동" },
    });
  });

  it("검색 실패와 재시도를 구분한다", async () => {
    const client: RegionSearchClient = {
      search: jest
        .fn()
        .mockRejectedValueOnce(new Error("failure"))
        .mockResolvedValueOnce(resolvedResult("재시도 성공")),
    };
    const { result } = renderHook(() => useRegionSearch(client));

    await act(async () => {
      await result.current.search("강남");
    });
    expect(result.current.state).toEqual({
      status: "failure",
      query: "강남",
    });

    await act(async () => {
      await result.current.search("강남");
    });
    expect(result.current.state).toMatchObject({
      status: "resolved",
      candidate: { displayName: "재시도 성공" },
    });
  });

  it("검색 취소는 진행 중 요청과 검색어를 함께 초기화한다", async () => {
    let signal: AbortSignal | undefined;
    const client: RegionSearchClient = {
      search: jest.fn((_query, requestSignal) => {
        signal = requestSignal;
        return new Promise(() => undefined);
      }),
    };
    const { result } = renderHook(() => useRegionSearch(client));

    act(() => result.current.setQuery("역삼동"));
    await act(async () => {
      void result.current.search("역삼동");
    });
    act(() => result.current.cancel());

    expect(signal?.aborted).toBe(true);
    expect(result.current.query).toBe("");
    expect(result.current.state).toEqual({ status: "empty" });
  });
});

function resolvedResult(displayName: string) {
  const candidate: RegionSearchCandidate = {
    id: displayName,
    displayName,
    region: {},
  };
  return { status: "resolved" as const, candidate };
}
