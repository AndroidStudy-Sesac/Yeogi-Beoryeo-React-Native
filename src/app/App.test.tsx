import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  REGIONAL_GUIDE_FAVORITES_SCHEMA_VERSION,
  REGIONAL_GUIDE_FAVORITES_STORAGE_KEY,
} from '../features/regional-guide/data/regionalGuideFavoriteRepository';
import { createRegionalGuideFavorite } from '../features/regional-guide/domain/regionalGuideFavorite';
import App from './App';

jest.useFakeTimers();

describe('<App />', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('공통 Navigation의 안내 탭에서 지역 가이드로 진입합니다', async () => {
    const { getByRole, getByText } = await render(<App />);

    expect(getByText('공통 개발 환경이 준비되었습니다.')).toBeTruthy();
    await fireEvent.press(getByRole('button', { name: '안내 탭' }));

    await waitFor(() => expect(getByText('지역별 배출 가이드')).toBeTruthy());
    await act(async () => jest.runOnlyPendingTimers());
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
    await act(async () => jest.runOnlyPendingTimers());
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
        getByLabelText('서울특별시 > 강남구 > 역삼1동 지역 가이드 보기'),
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
        getByLabelText('서울특별시 > 강남구 > 역삼1동 지역 가이드 보기'),
      ).toBeTruthy(),
    );
    expect(
      getByRole('button', { name: '저장 탭' }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    await act(async () => jest.runOnlyPendingTimers());
  });
});
