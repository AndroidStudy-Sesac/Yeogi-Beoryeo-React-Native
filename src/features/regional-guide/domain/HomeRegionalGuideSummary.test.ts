import { buildHomeRegionalGuideSummary } from './HomeRegionalGuideSummary';

describe('buildHomeRegionalGuideSummary', () => {
  it('일반쓰레기 기준 요일과 시간을 Kotlin 앱 형식으로 요약합니다', () => {
    expect(
      buildHomeRegionalGuideSummary(
        {
          sidoName: '서울특별시',
          sigunguName: '강남구',
          targetRegionName: '역삼1동',
          schedules: [
            {
              wasteType: 'general',
              disposalDays: '월, 수, 금',
              disposalStartTime: '18:00',
              disposalEndTime: '23:59',
            },
          ],
        },
        'fallback',
      ),
    ).toEqual({
      regionName: '서울특별시 > 강남구 > 역삼1동',
      disposalDays: '월, 수, 금',
      disposalTime: '18:00 ~ 23:59',
      hasDifferentDisposalDays: false,
      hasDifferentDisposalTime: false,
    });
  });

  it('품목별 일정 차이와 확인이 필요한 대표 요일을 구분합니다', () => {
    const summary = buildHomeRegionalGuideSummary(
      {
        schedules: [
          { wasteType: 'general', disposalDays: '기타', disposalStartTime: '18:00' },
          { wasteType: 'food', disposalDays: '화', disposalEndTime: '22:00' },
        ],
      },
      '서울특별시 > 강남구',
    );

    expect(summary).toMatchObject({
      regionName: '서울특별시 > 강남구',
      disposalDays: undefined,
      disposalTime: '18:00 이후',
      hasDifferentDisposalDays: true,
      hasDifferentDisposalTime: true,
    });
  });
});
