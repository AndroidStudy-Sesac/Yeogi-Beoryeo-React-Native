import { act, renderHook, waitFor } from "@testing-library/react-native";

import type { RegionalGuideFavoriteRepository } from "../data/regionalGuideFavoriteRepository";
import type { RegionalGuideId } from "../domain/RegionalGuideFavorite";
import { useRegionalGuideFavorites } from "./useRegionalGuideFavorites";

const guideId = "regional-guide:v1:guide" as RegionalGuideId;

describe("useRegionalGuideFavorites", () => {
  it("저장된 즐겨찾기를 초기화 시 복원한다", async () => {
    const repository = createRepository([guideId]);
    const { result } = renderHook(() => useRegionalGuideFavorites(repository));

    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    expect(result.current.isFavorite(guideId)).toBe(true);
  });

  it("즐겨찾기를 추가하고 해제한다", async () => {
    const repository = createRepository([]);
    const { result } = renderHook(() => useRegionalGuideFavorites(repository));
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    act(() => result.current.toggle(guideId));
    expect(result.current.isFavorite(guideId)).toBe(true);
    await waitFor(() =>
      expect(repository.save).toHaveBeenCalledWith([guideId]),
    );

    act(() => result.current.toggle(guideId));
    expect(result.current.isFavorite(guideId)).toBe(false);
    await waitFor(() => expect(repository.save).toHaveBeenLastCalledWith([]));
  });

  it("빠른 반복 입력을 직렬 저장하고 최종 상태를 일관되게 유지한다", async () => {
    const firstWrite = deferred<void>();
    const repository = createRepository([]);
    repository.save
      .mockImplementationOnce(() => firstWrite.promise)
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useRegionalGuideFavorites(repository));
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    act(() => {
      result.current.toggle(guideId);
      result.current.toggle(guideId);
      result.current.toggle(guideId);
    });
    expect(result.current.isFavorite(guideId)).toBe(true);
    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1));

    await act(async () => firstWrite.resolve());
    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(3));

    expect(repository.save.mock.calls).toEqual([
      [[guideId]],
      [[]],
      [[guideId]],
    ]);
    expect(result.current.isFavorite(guideId)).toBe(true);
  });

  it("읽기 실패 시 빈 상태로 시작하고 앱 흐름을 계속한다", async () => {
    const repository = createRepository([]);
    repository.restore.mockRejectedValue(new Error("read failure"));
    const { result } = renderHook(() => useRegionalGuideFavorites(repository));

    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    expect(result.current.state).toEqual({
      status: "ready",
      guideIds: [],
      persistenceError: "read",
    });
  });

  it("쓰기 실패 시 마지막 정상 저장 상태를 유지한다", async () => {
    const repository = createRepository([guideId]);
    repository.save.mockRejectedValue(new Error("write failure"));
    const { result } = renderHook(() => useRegionalGuideFavorites(repository));
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    act(() => result.current.toggle(guideId));
    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: "ready",
        guideIds: [guideId],
        persistenceError: "write",
      }),
    );
  });
});

function createRepository(initialGuideIds: RegionalGuideId[]) {
  return {
    restore: jest.fn().mockResolvedValue(initialGuideIds),
    save: jest.fn().mockResolvedValue(undefined),
  } satisfies jest.Mocked<RegionalGuideFavoriteRepository>;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}
