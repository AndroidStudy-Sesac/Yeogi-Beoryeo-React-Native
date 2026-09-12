import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import App from './App';

describe('<App />', () => {
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
});
