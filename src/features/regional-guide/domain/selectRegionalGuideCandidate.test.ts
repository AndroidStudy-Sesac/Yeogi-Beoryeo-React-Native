import type { RegionalDisposalGuide } from './RegionalDisposalGuide';
import {
  mergeDuplicateCandidateRowsByLatestDate,
  selectRegionalGuideCandidate,
} from './selectRegionalGuideCandidate';

describe('지역 가이드 후보 선택', () => {
  it('정확히 일치하는 관리 구역을 전체 권역보다 우선합니다', () => {
    const exact = guide('역삼1동', '역삼1동');
    const overall = guide('강남구', '강남구 전체');

    expect(select([overall, exact], '역삼1동')).toEqual({
      status: 'selected',
      guide: exact,
    });
  });

  it('정확히 일치하지만 서로 다른 안내가 여러 건이면 후보를 반환합니다', () => {
    const candidates = [
      guide('1권역', '역삼1동'),
      guide('2권역', '역삼1동'),
    ];

    expect(select(candidates, '역삼1동')).toEqual({
      status: 'candidates',
      guides: candidates,
      reason: 'multiple-exact-matches',
    });
  });

  it.each([
    ['괴정제2동', '괴정1~3동'],
    ['부곡제4동', '부곡1,4동'],
    ['신사2동', '신사동'],
  ])('%s 선택을 축약 관리 구역 %s와 연결합니다', (selected, provided) => {
    const candidate = guide(provided, provided);

    expect(select([candidate], selected)).toEqual({
      status: 'selected',
      guide: candidate,
    });
  });

  it('직접 일치가 없으면 읍면동 유형에 맞는 권역 안내를 fallback합니다', () => {
    const dongArea = guide('강남구 동지역', '동지역');

    expect(select([dongArea], '역삼1동')).toEqual({
      status: 'selected',
      guide: dongArea,
    });
    expect(select([dongArea], '가곡면')).toEqual({ status: 'not-provided' });
  });

  it('적용 관계를 확인할 수 없는 다른 읍면동 안내는 미제공으로 구분합니다', () => {
    expect(select([guide('삼성동', '삼성동')], '역삼1동')).toEqual({
      status: 'not-provided',
    });
  });

  it('같은 시군구명이 여러 시도에 있어도 선택한 시도의 안내만 사용합니다', () => {
    const seoul = {
      ...guide('중구 전체', '중구 전체'),
      sidoName: '서울특별시',
      sigunguName: '중구',
    };
    const busan = {
      ...guide('중구 전체', '중구 전체'),
      sidoName: '부산광역시',
      sigunguName: '중구',
    };

    expect(
      selectRegionalGuideCandidate([busan, seoul], {
        sidoName: '서울특별시',
        sigunguName: '중구',
      }),
    ).toEqual({ status: 'selected', guide: seoul });
  });

  it('선택 행정동의 법정동 별칭으로 제공된 안내도 직접 일치로 선택합니다', () => {
    const candidate = guide('청운동', '청운동');

    expect(
      selectRegionalGuideCandidate([candidate], {
        sidoName: '서울특별시',
        sigunguName: '종로구',
        eupmyeondongName: '청운효자동',
        eupmyeondongAliases: ['청운동', '신교동'],
      }),
    ).toEqual({ status: 'selected', guide: candidate });
  });

  it('직접 안내가 없으면 다른 읍면동을 제외한 일반 권역 후보만 제공합니다', () => {
    const broadCandidates = [
      guide('1권역', '문전수거 지역'),
      guide('2권역', '거점수거 지역'),
    ];

    expect(
      select([...broadCandidates, guide('삼성동', '삼성동')], '역삼1동'),
    ).toEqual({
      status: 'candidates',
      guides: broadCandidates,
      reason: 'fallback-because-direct-match-not-found',
    });
  });

  it('동일 후보 행은 최종수정일을 기준으로 최신 안내를 선택합니다', () => {
    const oldGuide = datedGuide('20240101120000', '월');
    const latestGuide = datedGuide('20240201120000', '화');

    expect(
      mergeDuplicateCandidateRowsByLatestDate([oldGuide, latestGuide]),
    ).toEqual([latestGuide]);
  });

  it('최종수정일이 없으면 데이터 기준일로 최신 안내를 선택합니다', () => {
    const oldGuide = criteriaDatedGuide('20240101', '월');
    const latestGuide = criteriaDatedGuide('20240201', '화');

    expect(
      mergeDuplicateCandidateRowsByLatestDate([oldGuide, latestGuide]),
    ).toEqual([latestGuide]);
  });

  it('날짜를 비교할 수 없으면 동일 후보의 일정을 안전하게 병합합니다', () => {
    const first = datedGuide('잘못된 날짜', '월');
    const second = datedGuide('20240201120000', '화');

    expect(
      mergeDuplicateCandidateRowsByLatestDate([first, second]),
    ).toEqual([
      expect.objectContaining({
        schedules: [
          expect.objectContaining({ disposalDays: '월' }),
          expect.objectContaining({ disposalDays: '화' }),
        ],
      }),
    ]);
  });
});

function select(
  guides: readonly RegionalDisposalGuide[],
  eupmyeondongName?: string,
) {
  return selectRegionalGuideCandidate(guides, {
    sigunguName: '강남구',
    ...(eupmyeondongName ? { eupmyeondongName } : {}),
  });
}

function guide(
  managementZoneName: string,
  targetRegionName: string,
): RegionalDisposalGuide {
  return { managementZoneName, targetRegionName, schedules: [] };
}

function datedGuide(
  lastModifiedPoint: string,
  disposalDays: string,
): RegionalDisposalGuide {
  return {
    managementZoneName: '역삼1동',
    targetRegionName: '역삼1동',
    disposalPlaceType: '문전수거',
    schedules: [{ wasteType: 'general', disposalDays }],
    sourceMetadata: { lastModifiedPoint },
  };
}

function criteriaDatedGuide(
  dataCriteriaDate: string,
  disposalDays: string,
): RegionalDisposalGuide {
  return {
    ...datedGuide('', disposalDays),
    sourceMetadata: { dataCriteriaDate },
  };
}
