import { fireEvent, render, waitFor } from '@testing-library/react-native';

import App from './App';

describe('<App />', () => {
  it('공통 Navigation의 안내 탭에서 지역 가이드로 진입합니다', async () => {
    const { getByRole, getByText } = await render(<App />);

    expect(getByText('공통 개발 환경이 준비되었습니다.')).toBeTruthy();
    await fireEvent.press(getByRole('button', { name: '안내 탭' }));

    await waitFor(() => expect(getByText('지역별 배출 가이드')).toBeTruthy());
  });
});
