import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { RegionalGuideFavoriteRepository } from '../../regional-guide/data/regionalGuideFavoriteRepository';
import { createRegionalGuideFavorite } from '../../regional-guide/domain/regionalGuideFavorite';
import { RegionalGuideFavoritesProvider } from '../../regional-guide/presentation/RegionalGuideFavoritesContext';
import { FavoritesScreen } from './FavoritesScreen';

const mockNavigate = jest.fn();
const mockParentNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    getParent: () => ({ navigate: mockParentNavigate }),
  }),
}));

describe('<FavoritesScreen />', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockParentNavigate.mockReset();
  });

  it('Kotlin 앱과 같은 제목·탭 순서·품목 빈 상태를 표시합니다', async () => {
    await renderScreen(repositoryReturning([]));

    expect(await screen.findByText('즐겨찾기')).toBeOnTheScreen();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map(tab => tab.props.accessibilityLabel)).toEqual([
      '품목 즐겨찾기 카테고리',
      '장소 즐겨찾기 카테고리',
      '지역 즐겨찾기 카테고리',
    ]);
    expect(
      screen.getByLabelText('품목 즐겨찾기 카테고리').props
        .accessibilityState,
    ).toEqual({ selected: true });
    expect(screen.getByText('아직 즐겨찾기한 품목이 없어요')).toBeOnTheScreen();
    expect(screen.getByLabelText('품목 검색하기')).toBeOnTheScreen();
  });

  it('loading과 load 오류를 구분하고 재시도합니다', async () => {
    const retry = deferred<readonly []>();
    const repository: RegionalGuideFavoriteRepository = {
      load: jest
        .fn()
        .mockRejectedValueOnce(new Error('read failed'))
        .mockImplementationOnce(() => retry.promise),
      save: jest.fn(async () => undefined),
    };
    await renderScreen(repository);

    expect(
      await screen.findByText('즐겨찾기를 불러오지 못했어요'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('다시 시도'));
    expect(screen.getByLabelText('로딩 중')).toBeOnTheScreen();
    retry.resolve([]);
    expect(
      await screen.findByText('아직 즐겨찾기한 품목이 없어요'),
    ).toBeOnTheScreen();
  });

  it('빈 상태에서 안내 탭의 지역 조회로 이동합니다', async () => {
    await renderScreen(repositoryReturning([]));

    await fireEvent.press(
      await screen.findByLabelText('지역 즐겨찾기 카테고리'),
    );

    await fireEvent.press(
      await screen.findByLabelText('지역별 배출 가이드 찾아보기'),
    );

    expect(mockParentNavigate).toHaveBeenCalledWith('RegionalGuideTab', {
      screen: 'RegionalGuide',
    });
  });

  it('카드 본문 상세 이동과 저장 해제를 분리합니다', async () => {
    const favorite = fixture();
    const repository = repositoryReturning([favorite]);
    await renderScreen(repository);

    await fireEvent.press(
      await screen.findByLabelText('지역 즐겨찾기 카테고리'),
    );

    await fireEvent.press(
      await screen.findByLabelText(/지역 가이드 보기$/),
    );
    expect(mockNavigate).toHaveBeenCalledWith('RegionalGuide', {
      entrySource: 'FAVORITES',
      initialFavoriteTargetId: favorite.targetId,
    });
    expect(repository.save).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText(/즐겨찾기$/));
    await waitFor(() => expect(repository.save).toHaveBeenCalledWith([]));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText('아직 즐겨찾기한 지역 가이드가 없어요'),
    ).toBeOnTheScreen();
  });

  it('Kotlin 앱과 같은 지역 경로와 대상·관리구역 보조정보를 표시합니다', async () => {
    await renderScreen(repositoryReturning([fixture()]));

    await fireEvent.press(
      await screen.findByLabelText('지역 즐겨찾기 카테고리'),
    );

    expect(screen.getByText('서울특별시 > 강남구 > 역삼1동')).toBeOnTheScreen();
    expect(screen.getByText('역삼1동 · 2권역')).toBeOnTheScreen();
    expect(screen.queryByText(/수거유형/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/지역 가이드 \d+개/)).not.toBeOnTheScreen();
  });
});

async function renderScreen(repository: RegionalGuideFavoriteRepository) {
  return render(
    <RegionalGuideFavoritesProvider repository={repository}>
      <FavoritesScreen />
    </RegionalGuideFavoritesProvider>,
  );
}

function repositoryReturning(
  favorites: readonly ReturnType<typeof fixture>[],
): RegionalGuideFavoriteRepository {
  return {
    load: jest.fn(async () => favorites),
    save: jest.fn(async () => undefined),
  };
}

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
      eupmyeondong: {
        id: 'eupmyeondong:1168064000',
        level: 'eupmyeondong',
        name: '역삼1동',
        parentId: 'sigungu:11680',
      },
    },
    {
      targetRegionName: '역삼1동',
      managementZoneName: '2권역',
      disposalPlaceType: '문전수거',
      schedules: [],
    },
    '2026-09-24T00:00:00.000Z',
  );
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}
