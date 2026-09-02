import { render } from '@testing-library/react-native';

import App from './App';

describe('<App />', () => {
  it('공통 환경 준비 화면을 표시합니다', async () => {
    const { getByText } = await render(<App />);

    expect(getByText('공통 개발 환경이 준비되었습니다.')).toBeTruthy();
  });
});
