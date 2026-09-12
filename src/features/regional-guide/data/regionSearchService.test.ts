import { createRegionSearchService } from './regionSearchService';

describe('지역 검색 service', () => {
  it.each([
    [
      '서울시 강남구 테헤란로 123',
      'resolved',
      ['서울특별시 강남구'],
    ],
    [
      '서울특별시 영등포구 문래로 110 (문래동)',
      'resolved',
      ['서울특별시 영등포구 문래동'],
    ],
    [
      '서울 강남구 역삼동',
      'candidates',
      ['서울특별시 강남구 역삼1동', '서울특별시 강남구 역삼2동'],
    ],
    [
      '경기도 수원시 영통구 망포동',
      'candidates',
      ['경기도 수원시 망포1동', '경기도 수원시 망포2동'],
    ],
    [
      '부산 사하구 괴정1동',
      'resolved',
      ['부산광역시 사하구 괴정제1동'],
    ],
    [
      '대전 유성구 봉산동',
      'resolved',
      ['대전광역시 유성구 구즉동'],
    ],
    [
      '전남 목포시 석현동',
      'resolved',
      ['전라남도 목포시 삼향동'],
    ],
    [
      '서울 성동구 도선동',
      'resolved',
      ['서울특별시 성동구 왕십리도선동'],
    ],
    ['광주시', 'resolved', ['경기도 광주시']],
  ] as const)(
    '%s 입력을 검증된 제공 가능 후보로 변환합니다',
    async (query, expectedStatus, expectedNames) => {
      const service = createRegionSearchService();
      const result = await service.search(
        query,
        new AbortController().signal,
      );
      const names =
        result.status === 'resolved'
          ? [result.candidate.displayName]
          : result.status === 'candidates'
            ? result.candidates.map(candidate => candidate.displayName)
            : [];

      expect(result.status).toBe(expectedStatus);
      expect(names).toEqual(expectedNames);
    },
  );

  it('첫 검색에 만든 인덱스를 반복 검색에서 재사용합니다', async () => {
    const service = createRegionSearchService();
    await service.search('역삼동', new AbortController().signal);
    await service.search('망포동', new AbortController().signal);

    const statistics = service.getStatistics();
    expect(statistics).toMatchObject({
      indexBuildCount: 1,
      searchCount: 2,
      candidateCount: 3_141,
    });
    expect(statistics.exactKeyCount).toBeGreaterThan(
      statistics.candidateCount ?? 0,
    );
  });

  it('이벤트 루프에 양보한 동안 취소되면 인덱스를 만들지 않습니다', async () => {
    const service = createRegionSearchService();
    const controller = new AbortController();
    const result = service.search('역삼동', controller.signal);
    controller.abort();

    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(service.getStatistics()).toMatchObject({
      indexBuildCount: 0,
      searchCount: 0,
    });
  });
});
