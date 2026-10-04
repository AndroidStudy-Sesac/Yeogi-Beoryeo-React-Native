import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  REGIONAL_GUIDE_FAVORITES_SCHEMA_VERSION,
  REGIONAL_GUIDE_FAVORITES_STORAGE_KEY,
} from '../features/regional-guide/data/regionalGuideFavoriteRepository';
import {
  HOME_REGIONAL_GUIDE_REPRESENTATIVE_SCHEMA_VERSION,
  HOME_REGIONAL_GUIDE_REPRESENTATIVE_STORAGE_KEY,
} from '../features/regional-guide/data/homeRegionalGuideRepresentativeRepository';
import { sharedRegionalGuideApiClient } from '../features/regional-guide/data/regionalGuideApi';
import { createRegionalGuideFavorite } from '../features/regional-guide/domain/regionalGuideFavorite';
import App from './App';

jest.useFakeTimers();

afterEach(async () => {
  await act(() => jest.runOnlyPendingTimers());
  await cleanup();
});

describe('<App />', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('Android 복원 세션에서 제출 결과와 다른 편집 입력을 함께 복원합니다', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(JSON.stringify({
      sessionId: 'restored-task', search: { query: '종이', submittedQuery: '건전지',
        handledInitialQuery: null, resultVersion: 1, scrollOffset: 0 },
    }));
    const { getByLabelText, getByText } = await render(<App searchSessionId="restored-task" />);
    await waitFor(() => expect(getByText('‘건전지’ 검색 결과 3개')).toBeTruthy());
    expect(getByLabelText('품목 검색 창')).toHaveProp('value', '종이');
  });

  it('품목 검색 입력을 앱 시작 화면에서 제공합니다', async () => {
    const { getByLabelText, getByRole } = await render(<App />);
    expect(getByLabelText('품목 검색 창')).toBeTruthy();
    expect(getByRole('button', { name: '검색' })).toBeDisabled();
  });

  it('실제 품목을 검색해 상세를 열고 돌아오면 편집 입력과 결과를 유지합니다', async () => {
    const { getByLabelText, getByRole, getByText } = await render(<App />);
    await fireEvent.changeText(getByLabelText('품목 검색 창'), '건전지');
    await fireEvent.press(getByRole('button', { name: '검색' }));
    await waitFor(() => expect(getByText('‘건전지’ 검색 결과 3개')).toBeTruthy());
    await fireEvent.changeText(getByLabelText('품목 검색 창'), '종이');
    await fireEvent.press(getByRole('button', { name: /^AA 건전지,/ }));
    await waitFor(() => expect(getByRole('header', { name: 'AA 건전지' })).toBeTruthy());
    expect(getByRole('header', { name: '배출방법' })).toBeTruthy();
    await fireEvent.press(getByRole('button', { name: '뒤로가기' }));
    await waitFor(() => expect(getByLabelText('품목 검색 창')).toHaveProp('value', '종이'));
    expect(getByText('‘건전지’ 검색 결과 3개')).toBeTruthy();
  });

  it('검색에서 안내 탭으로 이동한 뒤 홈으로 돌아오면 편집 입력과 결과를 유지합니다', async () => {
    const { getByLabelText, getByRole, getByText } = await render(<App />);
    await fireEvent.changeText(getByLabelText('품목 검색 창'), '건전지');
    await fireEvent.press(getByRole('button', { name: '검색' }));
    await waitFor(() => expect(getByText('‘건전지’ 검색 결과 3개')).toBeTruthy());
    await fireEvent.changeText(getByLabelText('품목 검색 창'), '종이');
    await fireEvent.press(getByRole('button', { name: '안내 탭' }));
    await waitFor(() => expect(getByText('지역별 배출 가이드')).toBeTruthy());
    await fireEvent.press(getByRole('button', { name: '홈 탭' }));
    await waitFor(() => expect(getByLabelText('품목 검색 창')).toHaveProp('value', '종이'));
    expect(getByText('‘건전지’ 검색 결과 3개')).toBeTruthy();
  });

  it('공통 탭 안에서 상세를 저장하고 앱을 재생성하면 상세와 검색을 복원합니다', async () => {
    const sessionId = 'nested-task';
    const first = await render(<App searchSessionId={sessionId} />);
    await waitFor(() => expect(first.getByLabelText('품목 검색 창')).toBeTruthy());
    await fireEvent.changeText(first.getByLabelText('품목 검색 창'), '건전지');
    await fireEvent.press(first.getByRole('button', { name: '검색' }));
    await waitFor(() => expect(first.getByText('‘건전지’ 검색 결과 3개')).toBeTruthy());
    await fireEvent.press(first.getByRole('button', { name: /^AA 건전지,/ }));
    await waitFor(() => expect(first.getByRole('header', { name: 'AA 건전지' })).toBeTruthy());
    await first.unmount();
    const saved = await AsyncStorage.getItem('item-search-session-v1');
    expect(saved && JSON.parse(saved)).toMatchObject({ sessionId, guideId: expect.any(String) });
    const restored = await render(<App searchSessionId={sessionId} />);
    await waitFor(() => expect(restored.getByRole('header', { name: 'AA 건전지' })).toBeTruthy());
    expect(restored.getByRole('button', { name: '홈 탭' })).toHaveProp('accessibilityState', { selected: true });
    await fireEvent.press(restored.getByRole('button', { name: '뒤로가기' }));
    await waitFor(() => expect(restored.getByText('‘건전지’ 검색 결과 3개')).toBeTruthy());
  });

  it('지역 선택에서 상세로 이동하고 복귀하면 선택 상태를 유지합니다', async () => {
    const { getByLabelText, getByRole, getByText } = await render(<App />);
    await fireEvent.press(getByRole('button', { name: '안내 탭' }));
    await waitFor(() => expect(getByText('지역별 배출 가이드')).toBeTruthy());

    await fireEvent.press(getByLabelText('시·도 선택'));
    await fireEvent.press(getByLabelText('시·도 옵션: 서울특별시'));
    await fireEvent.press(getByLabelText('시·군·구 선택'));
    await fireEvent.press(getByLabelText('시·군·구 옵션: 강남구'));
    await fireEvent.press(getByLabelText('선택한 지역 조회'));

    await waitFor(() =>
      expect(
        getByLabelText('선택 지역: 서울특별시 > 강남구'),
      ).toBeTruthy(),
    );
    await fireEvent.press(getByLabelText('지역 변경'));

    await waitFor(() => expect(getByText('지역별 배출 가이드')).toBeTruthy());
    expect(getByText('서울특별시 > 강남구')).toBeTruthy();
  });

  it('저장 목록에서 연 지역 상세의 뒤로가기는 저장 목록으로 복귀합니다', async () => {
    const favorite = createRegionalGuideFavorite(
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
        schedules: [],
      },
      '2026-09-24T00:00:00.000Z',
    );
    await AsyncStorage.setItem(
      REGIONAL_GUIDE_FAVORITES_STORAGE_KEY,
      JSON.stringify({
        version: REGIONAL_GUIDE_FAVORITES_SCHEMA_VERSION,
        favorites: [favorite],
      }),
    );
    const { getByLabelText, getByRole } = await render(<App />);

    await fireEvent.press(getByRole('button', { name: '저장 탭' }));
    await fireEvent.press(
      await waitFor(() => getByLabelText('지역 즐겨찾기 카테고리')),
    );
    await fireEvent.press(
      await waitFor(() =>
        getByLabelText(
          '서울특별시 > 강남구 > 역삼1동, 역삼1동 · 2권역 지역 가이드 보기',
        ),
      ),
    );
    await waitFor(() =>
      expect(
        getByLabelText('선택 지역: 서울특별시 > 강남구 > 역삼1동'),
      ).toBeTruthy(),
    );

    await fireEvent.press(getByLabelText('지역 변경'));

    await waitFor(() =>
      expect(
        getByLabelText(
          '서울특별시 > 강남구 > 역삼1동, 역삼1동 · 2권역 지역 가이드 보기',
        ),
      ).toBeTruthy(),
    );
    expect(
      getByRole('button', { name: '저장 탭' }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    await act(async () => jest.runOnlyPendingTimers());
  });

  it('홈 요약에서 상세를 열고 복귀하면 기존 정상 요약을 유지합니다', async () => {
    const selection = {
      sido: { id: 'sido:11', level: 'sido' as const, name: '서울특별시' },
      sigungu: {
        id: 'sigungu:11680',
        level: 'sigungu' as const,
        name: '강남구',
        parentId: 'sido:11',
      },
      eupmyeondong: {
        id: 'eupmyeondong:1168064000',
        level: 'eupmyeondong' as const,
        name: '역삼1동',
        parentId: 'sigungu:11680',
      },
    };
    const guide = {
      sidoName: '서울특별시',
      sigunguName: '강남구',
      targetRegionName: '역삼1동',
      managementZoneName: '2권역',
      schedules: [
        {
          wasteType: 'general' as const,
          disposalDays: '월, 수, 금',
          disposalStartTime: '18:00',
        },
      ],
    };
    const favorite = createRegionalGuideFavorite(
      selection,
      guide,
      '2026-09-24T00:00:00.000Z',
    );
    await AsyncStorage.multiSet([
      [
        REGIONAL_GUIDE_FAVORITES_STORAGE_KEY,
        JSON.stringify({
          version: REGIONAL_GUIDE_FAVORITES_SCHEMA_VERSION,
          favorites: [favorite],
        }),
      ],
      [
        HOME_REGIONAL_GUIDE_REPRESENTATIVE_STORAGE_KEY,
        JSON.stringify({
          version: HOME_REGIONAL_GUIDE_REPRESENTATIVE_SCHEMA_VERSION,
          targetId: favorite.targetId,
        }),
      ],
    ]);
    const fetchSpy = jest
      .spyOn(sharedRegionalGuideApiClient, 'fetchRegionalDisposalGuides')
      .mockResolvedValue({ status: 'success', guides: [guide] });
    const { getByLabelText } = await render(<App />);

    await fireEvent.press(
      await waitFor(() =>
        getByLabelText(
          '서울특별시 > 강남구 > 역삼1동 지역 가이드 상세 보기',
        ),
      ),
    );
    await waitFor(() =>
      expect(
        getByLabelText('선택 지역: 서울특별시 > 강남구 > 역삼1동'),
      ).toBeTruthy(),
    );
    await fireEvent.press(getByLabelText('지역 변경'));

    await waitFor(() =>
      expect(
        getByLabelText(
          '서울특별시 > 강남구 > 역삼1동 지역 가이드 상세 보기',
        ),
      ).toBeTruthy(),
    );
    expect(getByLabelText('월, 수, 금')).toBeTruthy();
    fetchSpy.mockRestore();
  });
});
