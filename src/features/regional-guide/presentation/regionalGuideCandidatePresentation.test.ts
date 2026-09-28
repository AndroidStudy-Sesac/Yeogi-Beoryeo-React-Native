import type { RegionSelection } from '../domain/Region';
import type { RegionalDisposalGuide } from '../domain/RegionalDisposalGuide';
import {
  presentRegionalGuideCandidates,
  regionalGuideCandidateDisplayMode,
} from './regionalGuideCandidatePresentation';

const selection: RegionSelection = {
  sido: { id: 'sido', level: 'sido', name: '서울특별시' },
  sigungu: {
    id: 'sigungu',
    level: 'sigungu',
    name: '강남구',
    parentId: 'sido',
  },
  eupmyeondong: {
    id: 'dong',
    level: 'eupmyeondong',
    name: '역삼1동',
    parentId: 'sigungu',
  },
};

describe('지역 가이드 후보 표시 정책', () => {
  it('복수 정확 일치 후보는 수거 유형 패널이 아닌 기존 후보 목록으로 표시합니다', () => {
    expect(
      regionalGuideCandidateDisplayMode(
        [guide('1권역', '역삼1동', '문전수거'), guide('2권역', '역삼1동', '거점수거')],
        'multiple-exact-matches',
      ),
    ).toBe('list');
  });

  it('직접 안내가 없는 문전·거점 후보는 수거 유형 패널로 표시합니다', () => {
    expect(
      regionalGuideCandidateDisplayMode(
        [guide('문전수거', '문전수거', '문전수거'), guide('거점수거', '거점수거', '거점수거')],
        'fallback-because-direct-match-not-found',
      ),
    ).toBe('collection-type');
  });

  it('일반 권역 후보는 fallback이어도 후보 목록을 유지합니다', () => {
    expect(
      regionalGuideCandidateDisplayMode(
        [guide('1권역', '역삼동', '문전수거'), guide('2권역', '삼성동', '거점수거')],
        'fallback-because-direct-match-not-found',
      ),
    ).toBe('list');
  });

  it('후보 이름을 중복 없이 조합하고 권역 번호의 자연 순서로 정렬합니다', () => {
    const candidates = presentRegionalGuideCandidates(
      [
        guide('10권역', '삼성동', '문전수거'),
        guide('2권역', '역삼1동', '거점수거'),
        guide('1권역', '역삼1동', '문전수거'),
      ],
      selection,
    );

    expect(candidates.map(candidate => candidate.label)).toEqual([
      '1권역 / 역삼1동',
      '2권역 / 역삼1동',
      '10권역 / 삼성동',
    ]);
  });

  it('같은 표시 이름 후보는 서로 다른 첫 번째 정보로 구분합니다', () => {
    const candidates = presentRegionalGuideCandidates(
      [guide('1권역', '역삼1동', '문전수거'), guide('1권역', '역삼1동', '거점수거')],
      selection,
    );

    expect(candidates.map(candidate => candidate.label)).toEqual([
      '1권역 / 역삼1동 / 거점수거',
      '1권역 / 역삼1동 / 문전수거',
    ]);
  });

  it('수거 유형 보조 설명은 정확한 원본 유형에만 제공합니다', () => {
    const candidates = presentRegionalGuideCandidates(
      [guide(undefined, undefined, '문전수거'), guide(undefined, undefined, '문전 배출')],
      selection,
    );

    expect(candidates.map(candidate => candidate.collectionTypeSupportingText)).toEqual([
      undefined,
      '집 앞 또는 지정된 배출장소에 배출하는 지역',
    ]);
  });
});

function guide(
  managementZoneName: string | undefined,
  targetRegionName: string | undefined,
  disposalPlaceType: string,
): RegionalDisposalGuide {
  return {
    managementZoneName,
    targetRegionName,
    disposalPlaceType,
    schedules: [],
  };
}
