import {
  createHomeRegionalGuideRepresentativeRepository,
  HOME_REGIONAL_GUIDE_REPRESENTATIVE_SCHEMA_VERSION,
  HOME_REGIONAL_GUIDE_REPRESENTATIVE_STORAGE_KEY,
  type RepresentativeKeyValueStorage,
} from './homeRegionalGuideRepresentativeRepository';

const TARGET_ID = 'regional-guide-v1|2:11|5:11680|0:|0:|0:|3:역삼동|0:';

describe('HomeRegionalGuideRepresentativeRepository', () => {
  it('Favorite과 별도 키에 대표 지역 식별자를 저장하고 복원합니다', async () => {
    const values = new Map<string, string>();
    const storage = memoryStorage(values);
    const repository = createHomeRegionalGuideRepresentativeRepository(storage);

    await repository.save(TARGET_ID);

    expect(JSON.parse(values.get(HOME_REGIONAL_GUIDE_REPRESENTATIVE_STORAGE_KEY)!))
      .toEqual({
        version: HOME_REGIONAL_GUIDE_REPRESENTATIVE_SCHEMA_VERSION,
        targetId: TARGET_ID,
      });
    await expect(repository.load()).resolves.toBe(TARGET_ID);
  });

  it.each([
    'not-json',
    JSON.stringify({ version: 2, targetId: TARGET_ID }),
    JSON.stringify({ version: 1, targetId: 'item-guide|battery' }),
  ])('잘못된 저장값은 대표 없음으로 복구합니다', async stored => {
    const repository = createHomeRegionalGuideRepresentativeRepository(
      memoryStorage(
        new Map([[HOME_REGIONAL_GUIDE_REPRESENTATIVE_STORAGE_KEY, stored]]),
      ),
    );

    await expect(repository.load()).resolves.toBeUndefined();
  });

  it('고정 해제는 명시적인 대표 없음 값을 저장합니다', async () => {
    const values = new Map<string, string>();
    const repository = createHomeRegionalGuideRepresentativeRepository(
      memoryStorage(values),
    );

    await repository.save(undefined);

    expect(JSON.parse(values.get(HOME_REGIONAL_GUIDE_REPRESENTATIVE_STORAGE_KEY)!))
      .toEqual({ version: 1, targetId: null });
  });
});

function memoryStorage(
  values: Map<string, string>,
): RepresentativeKeyValueStorage {
  return {
    getItem: jest.fn(async key => values.get(key) ?? null),
    setItem: jest.fn(async (key, value) => {
      values.set(key, value);
    }),
  };
}
