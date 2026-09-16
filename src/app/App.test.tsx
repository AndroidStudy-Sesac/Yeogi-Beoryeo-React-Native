import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import App from './App';

jest.useFakeTimers();

describe('<App />', () => {
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

    await waitFor(() => expect(getByText('배출 안내 상세')).toBeTruthy());
    expect(getByLabelText('선택 지역: 서울특별시 > 강남구')).toBeTruthy();
    await fireEvent.press(getByLabelText('지역 선택으로 돌아가기'));

    await waitFor(() => expect(getByText('지역별 배출 가이드')).toBeTruthy());
    expect(getByText('서울특별시 > 강남구')).toBeTruthy();
    await act(async () => jest.runOnlyPendingTimers());
  });
});
