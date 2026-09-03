import { act, renderHook, waitFor } from "@testing-library/react-native";

import type { HomeRegionalGuideRepresentativeRepository } from "../data/homeRegionalGuideRepresentativeRepository";
import type { RegionalGuideId } from "../domain/RegionalGuideFavorite";
import type { RegionalGuideFavoriteState } from "./useRegionalGuideFavorites";
import {
  resolveRepresentativeGuideId,
  useHomeRegionalGuideRepresentative,
} from "./useHomeRegionalGuideRepresentative";

const firstGuideId = "regional-guide:v1:first" as RegionalGuideId;
const secondGuideId = "regional-guide:v1:second" as RegionalGuideId;

describe("useHomeRegionalGuideRepresentative", () => {
  it("저장된 식별자가 Favorite이면 그대로 복원한다", async () => {
    const repository = createRepository(secondGuideId);
    const { result } = renderHook(() =>
      useHomeRegionalGuideRepresentative(
        readyFavorites([firstGuideId, secondGuideId]),
        repository,
      ),
    );

    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    expect(result.current.state).toMatchObject({ guideId: secondGuideId });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("저장값이 Favorite가 아니면 대표 지역을 해제하고 보정 저장한다", async () => {
    const repository = createRepository(secondGuideId);
    const { result } = renderHook(() =>
      useHomeRegionalGuideRepresentative(
        readyFavorites([firstGuideId]),
        repository,
      ),
    );

    await waitFor(() =>
      expect(repository.save).toHaveBeenCalledWith(undefined),
    );
    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: "ready",
        guideId: undefined,
        isPersisting: false,
      }),
    );
  });

  it("대표 Favorite 해제가 저장되면 다른 Favorite이 있어도 고정을 해제한다", async () => {
    const repository = createRepository(firstGuideId);
    const { result, rerender } = renderHook(
      ({ favoriteState }: { favoriteState: RegionalGuideFavoriteState }) =>
        useHomeRegionalGuideRepresentative(favoriteState, repository),
      {
        initialProps: {
          favoriteState: readyFavorites([firstGuideId, secondGuideId]),
        },
      },
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    rerender({ favoriteState: readyFavorites([secondGuideId]) });

    await waitFor(() =>
      expect(repository.save).toHaveBeenCalledWith(undefined),
    );
    expect(result.current.state).toMatchObject({ guideId: undefined });
  });

  it("Favorite가 모두 해제되면 대표 지역 없음으로 저장한다", async () => {
    const repository = createRepository(firstGuideId);
    const { result, rerender } = renderHook(
      ({ favoriteState }: { favoriteState: RegionalGuideFavoriteState }) =>
        useHomeRegionalGuideRepresentative(favoriteState, repository),
      { initialProps: { favoriteState: readyFavorites([firstGuideId]) } },
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    rerender({ favoriteState: readyFavorites([]) });

    await waitFor(() =>
      expect(repository.save).toHaveBeenCalledWith(undefined),
    );
    expect(result.current.state).toMatchObject({ guideId: undefined });
  });

  it("현재 Favorite인 지역만 대표로 선택한다", async () => {
    const repository = createRepository(firstGuideId);
    const { result } = renderHook(() =>
      useHomeRegionalGuideRepresentative(
        readyFavorites([firstGuideId, secondGuideId]),
        repository,
      ),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    act(() =>
      result.current.select("regional-guide:v1:unknown" as RegionalGuideId),
    );
    expect(repository.save).not.toHaveBeenCalled();

    act(() => result.current.select(secondGuideId));
    await waitFor(() =>
      expect(repository.save).toHaveBeenCalledWith(secondGuideId),
    );
  });

  it("Favorite이 있어도 사용자가 고정하기 전에는 대표 지역을 자동 선택하지 않는다", async () => {
    const repository = createRepository(undefined);
    const { result } = renderHook(() =>
      useHomeRegionalGuideRepresentative(
        readyFavorites([firstGuideId, secondGuideId]),
        repository,
      ),
    );

    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    expect(result.current.state).toMatchObject({ guideId: undefined });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("사용자가 대표 지역 고정을 해제하면 대표 없음으로 저장한다", async () => {
    const repository = createRepository(firstGuideId);
    const { result } = renderHook(() =>
      useHomeRegionalGuideRepresentative(
        readyFavorites([firstGuideId]),
        repository,
      ),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    act(() => result.current.clear());

    await waitFor(() =>
      expect(repository.save).toHaveBeenCalledWith(undefined),
    );
    expect(result.current.state).toMatchObject({ guideId: undefined });
  });

  it("Favorite 저장 중에는 optimistic 목록으로 fallback하지 않는다", async () => {
    const repository = createRepository(firstGuideId);
    const { result, rerender } = renderHook(
      ({ favoriteState }: { favoriteState: RegionalGuideFavoriteState }) =>
        useHomeRegionalGuideRepresentative(favoriteState, repository),
      { initialProps: { favoriteState: readyFavorites([firstGuideId]) } },
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    rerender({
      favoriteState: {
        status: "ready",
        guideIds: [],
        isPersisting: true,
      },
    });

    expect(result.current.state).toMatchObject({ guideId: firstGuideId });
    expect(repository.save).not.toHaveBeenCalled();
  });
});

describe("resolveRepresentativeGuideId", () => {
  it("저장값이 Favorite일 때만 대표 지역으로 결정한다", () => {
    expect(
      resolveRepresentativeGuideId(secondGuideId, [
        firstGuideId,
        secondGuideId,
      ]),
    ).toBe(secondGuideId);
    expect(
      resolveRepresentativeGuideId(secondGuideId, [firstGuideId]),
    ).toBeUndefined();
    expect(
      resolveRepresentativeGuideId(undefined, [firstGuideId]),
    ).toBeUndefined();
  });
});

function readyFavorites(
  guideIds: RegionalGuideId[],
): RegionalGuideFavoriteState {
  return { status: "ready", guideIds, isPersisting: false };
}

function createRepository(guideId: RegionalGuideId | undefined) {
  return {
    restore: jest.fn().mockResolvedValue(guideId),
    save: jest.fn().mockResolvedValue(undefined),
  } satisfies jest.Mocked<HomeRegionalGuideRepresentativeRepository>;
}
