import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import App from './App';

jest.useFakeTimers();

afterEach(async () => {
  await act(() => jest.runOnlyPendingTimers());
  await cleanup();
});

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
});
