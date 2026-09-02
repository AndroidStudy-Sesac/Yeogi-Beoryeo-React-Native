import type { RegionalGuideId } from "../domain/RegionalGuideFavorite";
import type { Region } from "../domain/Region";
import type { LegacyRegionalGuideFavoriteReader } from "./legacyRegionalGuideFavoriteReader";
import {
  createMigratingRegionalGuideFavoriteRepository,
  decodeLegacyRegionalGuideFavoriteKey,
  mapLegacyRegionalGuideFavorites,
  REGIONAL_GUIDE_FAVORITES_MIGRATION_STORAGE_KEY,
  runRegionalGuideFavoriteMigration,
} from "./regionalGuideFavoriteMigration";
import type {
  RegionalGuideFavoriteRepository,
  RegionalGuideFavoriteStorage,
} from "./regionalGuideFavoriteRepository";

const regions: Region[] = [
  { id: "sido:11", name: "서울특별시", level: "sido" },
  {
    id: "sigungu:11680",
    name: "강남구",
    level: "sigungu",
    parentId: "sido:11",
  },
  {
    id: "eupmyeondong:1168064000",
    name: "역삼1동",
    level: "eupmyeondong",
    parentId: "sigungu:11680",
  },
  { id: "sido:41", name: "경기도", level: "sido" },
  {
    id: "sigungu:41110",
    name: "수원시",
    level: "sigungu",
    parentId: "sido:41",
  },
];
const seoulGuideId =
  "regional-guide:v1:eupmyeondong%3A1168064000" as RegionalGuideId;
const suwonGuideId = "regional-guide:v1:sigungu%3A41110" as RegionalGuideId;

describe("regionalGuideFavoriteMigration", () => {
  it("기존 v1/v2 길이 접두 식별자를 안전하게 해석한다", () => {
    const targetId = encodeLegacyKey(
      "regional-guide-v2",
      "서울특별시",
      "강남구",
      "역삼1동",
      "역삼1동 일부지역",
      "강남구 관리구역",
    );

    expect(decodeLegacyRegionalGuideFavoriteKey(targetId)).toEqual({
      sido: "서울특별시",
      sigungu: "강남구",
      eupmyeondong: "역삼1동",
      targetRegionName: "역삼1동 일부지역",
      managementZoneName: "강남구 관리구역",
    });
    expect(
      decodeLegacyRegionalGuideFavoriteKey("regional-guide-v1|broken"),
    ).toBeUndefined();
  });

  it("Room 행을 현재 행정코드 기반 ID로 바꾸고 중복을 제거한다", () => {
    const firstTargetId = encodeLegacyKey(
      "regional-guide-v1",
      "서울특별시",
      "강남구",
      "역삼1동",
      "역삼1동",
    );
    const secondTargetId = encodeLegacyKey(
      "regional-guide-v2",
      "서울특별시",
      "강남구",
      "역삼1동",
      "역삼1동",
      "1권역",
    );

    expect(
      mapLegacyRegionalGuideFavorites(
        [{ targetId: firstTargetId }, { targetId: secondTargetId }],
        regions,
      ),
    ).toEqual({ guideIds: [seoulGuideId], skippedCount: 0 });
  });

  it("행정구가 붙은 기존 시군구를 현재 시 단위 asset에 연결한다", () => {
    const targetId = encodeLegacyKey(
      "regional-guide-v2",
      "경기도",
      "수원시 영통구",
      undefined,
      "수원시",
      "수원시",
    );

    expect(mapLegacyRegionalGuideFavorites([{ targetId }], regions)).toEqual({
      guideIds: [suwonGuideId],
      skippedCount: 0,
    });
  });

  it("손상 식별자와 현재 asset에서 사라진 읍면동은 건너뛴다", () => {
    const removedTargetId = encodeLegacyKey(
      "regional-guide-v1",
      "서울특별시",
      "강남구",
      "사라진동",
      "사라진동",
    );

    expect(
      mapLegacyRegionalGuideFavorites(
        [{ targetId: "broken" }, { targetId: removedTargetId }],
        regions,
      ),
    ).toEqual({ guideIds: [], skippedCount: 2 });
  });

  it("기존 AsyncStorage 값과 합친 뒤 완료 표시로 반복 실행을 막는다", async () => {
    const existingGuideId =
      "regional-guide:v1:sigungu%3A11680" as RegionalGuideId;
    const repository = createRepository([existingGuideId]);
    const storage = createStorage();
    const reader = createReader({
      status: "ready",
      favorites: [
        {
          targetId: encodeLegacyKey(
            "regional-guide-v1",
            "서울특별시",
            "강남구",
            "역삼1동",
            "역삼1동",
          ),
        },
      ],
    });

    await expect(
      runRegionalGuideFavoriteMigration(repository, storage, reader),
    ).resolves.toEqual({
      status: "completed",
      migratedCount: 1,
      skippedCount: 0,
    });
    expect(repository.save).toHaveBeenCalledWith([
      existingGuideId,
      seoulGuideId,
    ]);

    await expect(
      runRegionalGuideFavoriteMigration(repository, storage, reader),
    ).resolves.toEqual({ status: "already-completed" });
    expect(reader.read).toHaveBeenCalledTimes(1);
    expect(storage.getItem).toHaveBeenCalledWith(
      REGIONAL_GUIDE_FAVORITES_MIGRATION_STORAGE_KEY,
    );
  });

  it("완료 표시 저장이 실패해 재시도되어도 즐겨찾기를 중복 저장하지 않는다", async () => {
    const repository = createRepository([]);
    const storage = createStorage();
    storage.setItem.mockRejectedValueOnce(new Error("marker write failed"));
    const reader = createReader({
      status: "ready",
      favorites: [
        {
          targetId: encodeLegacyKey(
            "regional-guide-v1",
            "서울특별시",
            "강남구",
            "역삼1동",
            "역삼1동",
          ),
        },
      ],
    });

    await expect(
      runRegionalGuideFavoriteMigration(repository, storage, reader),
    ).resolves.toEqual({ status: "retryable-failure" });
    await expect(
      runRegionalGuideFavoriteMigration(repository, storage, reader),
    ).resolves.toMatchObject({ status: "completed" });

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith([seoulGuideId]);
  });

  it("기존 Room DB가 없는 사용자도 완료 표시 후 기존 RN 값을 유지한다", async () => {
    const repository = createRepository([seoulGuideId]);
    const storage = createStorage();
    const reader = createReader({ status: "database-missing" });

    await expect(
      runRegionalGuideFavoriteMigration(repository, storage, reader),
    ).resolves.toEqual({
      status: "completed",
      migratedCount: 0,
      skippedCount: 0,
    });
    expect(repository.save).not.toHaveBeenCalled();

    await expect(
      runRegionalGuideFavoriteMigration(repository, storage, reader),
    ).resolves.toEqual({ status: "already-completed" });
    expect(reader.read).toHaveBeenCalledTimes(1);
  });

  it("Room 읽기 실패가 기존 AsyncStorage 복원을 막지 않는다", async () => {
    const repository = createRepository([seoulGuideId]);
    const storage = createStorage();
    const migratingRepository = createMigratingRegionalGuideFavoriteRepository(
      repository,
      storage,
      createReader({ status: "unreadable" }),
    );

    await expect(migratingRepository.restore()).resolves.toEqual([
      seoulGuideId,
    ]);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

function encodeLegacyKey(
  version: "regional-guide-v1" | "regional-guide-v2",
  ...fields: Array<string | undefined>
): string {
  const expectedFieldCount = version === "regional-guide-v1" ? 4 : 5;
  expect(fields).toHaveLength(expectedFieldCount);
  return `${version}|${fields
    .map((field) => (field === undefined ? "-1:" : `${field.length}:${field}`))
    .join("")}`;
}

function createRepository(initialGuideIds: RegionalGuideId[]) {
  let guideIds = initialGuideIds;
  return {
    restore: jest.fn(() => Promise.resolve(guideIds)),
    save: jest.fn((nextGuideIds: readonly RegionalGuideId[]) => {
      guideIds = [...nextGuideIds];
      return Promise.resolve();
    }),
  } satisfies jest.Mocked<RegionalGuideFavoriteRepository>;
}

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: jest.fn((key: string) => Promise.resolve(values.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      values.set(key, value);
      return Promise.resolve();
    }),
  } satisfies jest.Mocked<RegionalGuideFavoriteStorage>;
}

function createReader(result: unknown) {
  return {
    read: jest.fn().mockResolvedValue(result),
  } satisfies jest.Mocked<LegacyRegionalGuideFavoriteReader>;
}
