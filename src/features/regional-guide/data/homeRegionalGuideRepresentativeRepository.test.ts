import type { RegionalGuideId } from "../domain/RegionalGuideFavorite";
import {
  createHomeRegionalGuideRepresentativeRepository,
  HOME_REGIONAL_GUIDE_REPRESENTATIVE_STORAGE_KEY,
  parseStoredRepresentativeGuideId,
} from "./homeRegionalGuideRepresentativeRepository";
import type { RegionalGuideFavoriteStorage } from "./regionalGuideFavoriteRepository";

const guideId = "regional-guide:v1:known" as RegionalGuideId;
const isKnownGuideId = (value: string): value is RegionalGuideId =>
  value === guideId;

describe("homeRegionalGuideRepresentativeRepository", () => {
  it("안정된 지역 가이드 식별자를 별도 키에 저장하고 복원한다", async () => {
    const storage = createStorage(null);
    const repository = createHomeRegionalGuideRepresentativeRepository(
      storage,
      isKnownGuideId,
    );

    await repository.save(guideId);

    expect(storage.setItem).toHaveBeenCalledWith(
      HOME_REGIONAL_GUIDE_REPRESENTATIVE_STORAGE_KEY,
      JSON.stringify({ version: 1, guideId }),
    );
  });

  it.each([
    "invalid-json",
    "null",
    "[]",
    JSON.stringify({ version: 2, guideId }),
    JSON.stringify({ version: 1, guideId: "regional-guide:v1:removed" }),
  ])("잘못됐거나 현재 asset에 없는 값은 빈 상태로 복구한다: %s", (value) => {
    expect(
      parseStoredRepresentativeGuideId(value, isKnownGuideId),
    ).toBeUndefined();
  });

  it("대표 지역 없음도 버전이 있는 명시적 상태로 저장한다", async () => {
    const storage = createStorage(null);
    const repository = createHomeRegionalGuideRepresentativeRepository(
      storage,
      isKnownGuideId,
    );

    await repository.save(undefined);

    expect(storage.setItem).toHaveBeenCalledWith(
      HOME_REGIONAL_GUIDE_REPRESENTATIVE_STORAGE_KEY,
      JSON.stringify({ version: 1, guideId: null }),
    );
  });
});

function createStorage(storedValue: string | null) {
  return {
    getItem: jest.fn().mockResolvedValue(storedValue),
    setItem: jest.fn().mockResolvedValue(undefined),
  } satisfies jest.Mocked<RegionalGuideFavoriteStorage>;
}
