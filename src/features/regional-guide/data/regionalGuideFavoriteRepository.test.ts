import { createRegionalGuideFavorite } from '../domain/regionalGuideFavorite';
import {
  createRegionalGuideFavoriteRepository,
  REGIONAL_GUIDE_FAVORITES_SCHEMA_VERSION,
  REGIONAL_GUIDE_FAVORITES_STORAGE_KEY,
  type FavoriteKeyValueStorage,
} from './regionalGuideFavoriteRepository';

describe('지역 가이드 Favorite repository', () => {
  it('버전 schema로 저장하고 중복 target을 하나만 유지합니다', async () => {
    const storage = memoryStorage();
    const repository = createRegionalGuideFavoriteRepository(storage);
    const favorite = fixture();

    await repository.save([favorite, favorite]);

    expect(
      JSON.parse((await storage.getItem(REGIONAL_GUIDE_FAVORITES_STORAGE_KEY))!),
    ).toEqual({
      version: REGIONAL_GUIDE_FAVORITES_SCHEMA_VERSION,
      favorites: [favorite],
    });
  });

  it('지원하지 않는 버전과 깨진 JSON은 앱 실행을 막지 않고 제외합니다', async () => {
    const unsupported = memoryStorage(
      JSON.stringify({ version: 999, favorites: [fixture()] }),
    );
    const malformed = memoryStorage('{');

    await expect(
      createRegionalGuideFavoriteRepository(unsupported).load(),
    ).resolves.toEqual([]);
    await expect(
      createRegionalGuideFavoriteRepository(malformed).load(),
    ).resolves.toEqual([]);
  });

  it('schema 안의 잘못된 개별 항목만 제외하고 정상 항목은 복원합니다', async () => {
    const favorite = fixture();
    const storage = memoryStorage(
      JSON.stringify({
        version: REGIONAL_GUIDE_FAVORITES_SCHEMA_VERSION,
        favorites: [
          favorite,
          { ...favorite, targetId: 'broken' },
          null,
          favorite,
        ],
      }),
    );

    await expect(
      createRegionalGuideFavoriteRepository(storage).load(),
    ).resolves.toEqual([favorite]);
  });
});

function fixture() {
  return createRegionalGuideFavorite(
    {
      sido: { id: 'sido:11', level: 'sido', name: '서울특별시' },
      sigungu: {
        id: 'sigungu:11680',
        level: 'sigungu',
        name: '강남구',
        parentId: 'sido:11',
      },
    },
    {
      targetRegionName: '강남구',
      managementZoneName: '전역',
      schedules: [],
    },
    '2026-09-24T00:00:00.000Z',
  );
}

function memoryStorage(initialValue: string | null = null): FavoriteKeyValueStorage {
  let value = initialValue;
  return {
    getItem: jest.fn(async () => value),
    setItem: jest.fn(async (_key, nextValue) => {
      value = nextValue;
    }),
  };
}
