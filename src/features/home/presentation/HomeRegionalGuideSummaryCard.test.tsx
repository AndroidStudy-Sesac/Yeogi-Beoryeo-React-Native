import { fireEvent, render, screen } from '@testing-library/react-native';

import { createRegionalGuideFavorite } from '../../regional-guide/domain/regionalGuideFavorite';
import { HomeRegionalGuideSummaryCard } from './HomeRegionalGuideSummaryCard';

const actions = {
  onOpenDetail: jest.fn(),
  onOpenRegionalGuide: jest.fn(),
  onOpenSaved: jest.fn(),
  onRetry: jest.fn(),
  onRetryFavorites: jest.fn(),
};

describe('<HomeRegionalGuideSummaryCard />', () => {
  beforeEach(() => {
    Object.values(actions).forEach(action => action.mockReset());
  });

  it('Favorite 없음과 대표 지역 없음에 서로 다른 안내와 이동 동작을 제공합니다', async () => {
    const { rerender } = await render(
      <HomeRegionalGuideSummaryCard {...actions} state={{ status: 'no-favorite' }} />,
    );
    await fireEvent.press(screen.getByLabelText('홈 지역 가이드 Favorite 없음'));
    expect(actions.onOpenRegionalGuide).toHaveBeenCalledTimes(1);
    expect(
      screen.getByLabelText(
        '지역 가이드를 즐겨찾기하면 배출 기준을 여기에서 확인할 수 있어요.',
      ),
    ).toBeOnTheScreen();

    await rerender(
      <HomeRegionalGuideSummaryCard
        {...actions}
        state={{ status: 'no-representative' }}
      />,
    );
    await fireEvent.press(screen.getByLabelText('홈 대표 지역 없음'));
    expect(actions.onOpenSaved).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('대표 지역을 고정해 주세요')).toBeOnTheScreen();
  });

  it('Kotlin 앱과 같은 지역 경로·배출 요일·시간과 상세 이동을 표시합니다', async () => {
    const favorite = fixture();
    await render(
      <HomeRegionalGuideSummaryCard
        {...actions}
        state={{
          status: 'ready',
          favorite,
          guide: {
            targetRegionName: '역삼1동',
            schedules: [],
          },
          summary: {
            regionName: '서울특별시 > 강남구 > 역삼1동',
            disposalDays: '월, 수, 금',
            disposalTime: '18:00 ~ 23:59',
            hasDifferentDisposalDays: false,
            hasDifferentDisposalTime: false,
          },
          isPartial: false,
          isRefreshing: false,
        }}
      />,
    );

    expect(screen.getByText('배출 요일')).toBeOnTheScreen();
    expect(screen.getByLabelText('월, 수, 금')).toBeOnTheScreen();
    expect(screen.getByText('배출 시간')).toBeOnTheScreen();
    expect(screen.getByLabelText('18:00 ~ 23:59')).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByLabelText('서울특별시 > 강남구 > 역삼1동 지역 가이드 상세 보기'),
    );
    expect(actions.onOpenDetail).toHaveBeenCalledTimes(1);
  });

  it('갱신 실패 시 이전 정상 요약과 다시 시도 동작을 함께 유지합니다', async () => {
    const favorite = fixture();
    await render(
      <HomeRegionalGuideSummaryCard
        {...actions}
        state={{
          status: 'ready',
          favorite,
          guide: { schedules: [] },
          summary: {
            regionName: '서울특별시 > 강남구 > 역삼1동',
            disposalDays: '월, 수, 금',
            disposalTime: '18:00 이후',
            hasDifferentDisposalDays: false,
            hasDifferentDisposalTime: false,
          },
          isPartial: false,
          isRefreshing: false,
          refreshError: 'network',
        }}
      />,
    );

    expect(screen.getByLabelText('월, 수, 금')).toBeOnTheScreen();
    expect(screen.getByText(/이전 결과를 표시합니다/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('배출 정보 다시 불러오기'));
    expect(actions.onRetry).toHaveBeenCalledTimes(1);
    expect(actions.onOpenDetail).not.toHaveBeenCalled();
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
      eupmyeondong: {
        id: 'eupmyeondong:1168064000',
        level: 'eupmyeondong',
        name: '역삼1동',
        parentId: 'sigungu:11680',
      },
    },
    { targetRegionName: '역삼1동', schedules: [] },
    '2026-09-24T00:00:00.000Z',
  );
}
