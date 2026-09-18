import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { createRegionCatalog } from '../data/regionRepository';
import type { RegionSearchService } from '../data/regionSearchService';
import type { Region, RegionSelection } from '../domain/Region';
import type { RegionSearchCandidate } from '../domain/RegionSearch';
import { RegionalGuideScreen } from './RegionalGuideScreen';

const catalog = createRegionCatalog(
  [
    { sidoName: '서울특별시', sigunguName: '강남구' },
    { sidoName: '부산광역시', sigunguName: '해운대구' },
  ],
  [
    {
      sidoName: '서울특별시',
      sigunguName: '강남구',
      managementZoneName: '강남구전역',
      targetRegionName: '강남구전역',
    },
    {
      sidoName: '부산광역시',
      sigunguName: '해운대구',
      managementZoneName: '해운대구전역',
      targetRegionName: '해운대구전역',
    },
  ],
  [
    {
      adminCode: '1168064000',
      sidoName: '서울특별시',
      sigunguName: '강남구',
      eupmyeondongName: '역삼1동',
    },
    {
      adminCode: '1168065000',
      sidoName: '서울특별시',
      sigunguName: '강남구',
      eupmyeondongName: '역삼2동',
    },
    {
      adminCode: '2635051000',
      sidoName: '부산광역시',
      sigunguName: '해운대구',
      eupmyeondongName: '우1동',
    },
  ],
);

describe('<RegionalGuideScreen />', () => {
  it('시도에서 읍면동까지 상위 지역에 맞는 선택지만 제공합니다', async () => {
    await render(<RegionalGuideScreen regionCatalog={catalog} />);

    expect(screen.getByLabelText('시·군·구 선택')).toBeDisabled();
    expect(screen.getByLabelText('읍·면·동 선택')).toBeDisabled();

    await selectOption('시·도', '서울특별시');
    await selectOption('시·군·구', '강남구');
    await selectOption('읍·면·동', '역삼1동');
    expect(screen.getByText('서울특별시 > 강남구 > 역삼1동')).toBeOnTheScreen();

    await selectOption('시·도', '부산광역시');
    expect(screen.getByText('시군구 선택')).toBeOnTheScreen();
    expect(screen.getByLabelText('읍·면·동 선택')).toBeDisabled();
    await selectOption('시·군·구', '해운대구');
    await fireEvent.press(screen.getByLabelText('읍·면·동 선택'));
    expect(screen.queryByLabelText('읍·면·동 옵션: 역삼1동')).toBeNull();
    expect(screen.getByLabelText('읍·면·동 옵션: 우1동')).toBeOnTheScreen();
  });

  it('복수 검색 후보를 선택하고 이전 후보 목록으로 돌아갑니다', async () => {
    const candidates = createYeoksamCandidates();
    const service = serviceReturning({ status: 'candidates', candidates });
    const onRegionSelected = jest.fn();
    await render(
      <RegionalGuideScreen
        debounceMilliseconds={300}
        onRegionSelected={onRegionSelected}
        regionCatalog={catalog}
        regionSearchService={service}
      />,
    );

    const searchInput = screen.getByLabelText('지역명 또는 주소 검색');
    await fireEvent.changeText(searchInput, '역삼동');
    await fireEvent(searchInput, 'submitEditing');
    await waitFor(() =>
      expect(
        screen.getByLabelText('지역 검색 후보 목록, 2개'),
      ).toBeOnTheScreen(),
    );

    await fireEvent.press(
      screen.getByLabelText('지역 후보: 서울특별시 강남구 역삼2동'),
    );
    expect(
      screen.getAllByText('서울특별시 > 강남구 > 역삼2동'),
    ).toHaveLength(2);
    expect(onRegionSelected).toHaveBeenCalledWith(candidates[1].region);

    await fireEvent.press(screen.getByText('검색 결과로 돌아가기'));
    expect(
      screen.getByLabelText('지역 검색 후보 목록, 2개'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('지역 후보: 서울특별시 강남구 역삼1동'),
    ).toBeOnTheScreen();
  });

  it('후보 없음과 검색 실패 재시도를 서로 다른 상태로 표시합니다', async () => {
    const service: RegionSearchService = {
      search: jest
        .fn()
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce({ status: 'not-found' }),
      getStatistics: () => ({ indexBuildCount: 0, searchCount: 0 }),
    };
    await render(
      <RegionalGuideScreen
        debounceMilliseconds={300}
        regionCatalog={catalog}
        regionSearchService={service}
      />,
    );
    const searchInput = screen.getByLabelText('지역명 또는 주소 검색');
    await fireEvent.changeText(searchInput, '없는동');
    await fireEvent(searchInput, 'submitEditing');
    await waitFor(() =>
      expect(screen.getByText('지역 검색에 실패했어요.')).toBeOnTheScreen(),
    );

    await fireEvent.press(screen.getByText('다시 시도'));
    await waitFor(() =>
      expect(screen.getByText('검색 결과를 찾지 못했어요.')).toBeOnTheScreen(),
    );
  });
});

async function selectOption(label: string, value: string) {
  await fireEvent.press(screen.getByLabelText(`${label} 선택`));
  await fireEvent.press(screen.getByLabelText(`${label} 옵션: ${value}`));
}

function createYeoksamCandidates(): readonly RegionSearchCandidate[] {
  const sido = catalog.findChildren('sido').find(region => region.name === '서울특별시');
  const sigungu = sido
    ? catalog.findChildren('sigungu', sido.id).find(region => region.name === '강남구')
    : undefined;
  if (!sido || !sigungu) throw new Error('테스트 지역을 찾지 못했습니다.');
  const eupmyeondongs = catalog.findChildren('eupmyeondong', sigungu.id);
  return eupmyeondongs.map(region => toCandidate({
    sido,
    sigungu,
    eupmyeondong: region,
  }));
}

function toCandidate(region: RegionSelection): RegionSearchCandidate {
  const path = [region.sido, region.sigungu, region.eupmyeondong].filter(
    (item): item is Region => Boolean(item),
  );
  return {
    id: path.map(item => item.id).join('|'),
    displayName: path.map(item => item.name).join(' '),
    region,
  };
}

function serviceReturning(
  result: Awaited<ReturnType<RegionSearchService['search']>>,
): RegionSearchService {
  return {
    search: jest.fn().mockResolvedValue(result),
    getStatistics: () => ({ indexBuildCount: 0, searchCount: 0 }),
  };
}
