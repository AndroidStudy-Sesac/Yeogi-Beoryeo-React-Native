import type { RegionalGuideId } from "../domain/RegionalGuideFavorite";
import {
  createRegionalGuideFavoriteRepository,
  parseStoredFavoriteIds,
  REGIONAL_GUIDE_FAVORITES_STORAGE_KEY,
  type RegionalGuideFavoriteStorage,
} from "./regionalGuideFavoriteRepository";

const knownGuideId = "regional-guide:v1:known" as RegionalGuideId;
const anotherKnownGuideId = "regional-guide:v1:another" as RegionalGuideId;
const isKnownGuideId = (guideId: string): guideId is RegionalGuideId =>
  guideId === knownGuideId || guideId === anotherKnownGuideId;

describe("regionalGuideFavoriteRepository", () => {
  it("저장 데이터가 없으면 빈 즐겨찾기를 복원한다", async () => {
    const storage = createStorage(null);
    const repository = createRegionalGuideFavoriteRepository(
      storage,
      isKnownGuideId,
    );

    await expect(repository.restore()).resolves.toEqual([]);
  });

  it.each([
    "not-json",
    "null",
    "[]",
    JSON.stringify({ version: 2, guideIds: [knownGuideId] }),
    JSON.stringify({ version: 1, guideIds: [1] }),
  ])("유효하지 않은 저장 형식을 빈 상태로 복구한다: %s", (storedValue) => {
    expect(parseStoredFavoriteIds(storedValue, isKnownGuideId)).toEqual([]);
  });

  it("중복 식별자를 제거하고 현재 지역 데이터에 없는 식별자를 무시한다", () => {
    const storedValue = JSON.stringify({
      version: 1,
      guideIds: [knownGuideId, "regional-guide:v1:removed", knownGuideId],
    });

    expect(parseStoredFavoriteIds(storedValue, isKnownGuideId)).toEqual([
      knownGuideId,
    ]);
  });

  it("안정된 가이드 식별자만 중복 없이 저장한다", async () => {
    const storage = createStorage(null);
    const repository = createRegionalGuideFavoriteRepository(
      storage,
      isKnownGuideId,
    );

    await repository.save([knownGuideId, knownGuideId, anotherKnownGuideId]);

    expect(storage.setItem).toHaveBeenCalledWith(
      REGIONAL_GUIDE_FAVORITES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        guideIds: [knownGuideId, anotherKnownGuideId],
      }),
    );
  });
});

function createStorage(storedValue: string | null) {
  return {
    getItem: jest.fn().mockResolvedValue(storedValue),
    setItem: jest.fn().mockResolvedValue(undefined),
  } satisfies jest.Mocked<RegionalGuideFavoriteStorage>;
}
