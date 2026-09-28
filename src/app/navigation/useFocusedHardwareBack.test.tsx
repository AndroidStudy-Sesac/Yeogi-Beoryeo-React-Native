import { renderHook } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import { useFocusedHardwareBack } from './useFocusedHardwareBack';

const mockUseFocusEffect = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => (() => void) | undefined) =>
    mockUseFocusEffect(effect),
}));

describe('useFocusedHardwareBack', () => {
  beforeEach(() => mockUseFocusEffect.mockClear());
  afterEach(() => jest.restoreAllMocks());

  it('화면이 포커스될 때만 뒤로가기를 구독하고 blur 시 해제합니다', async () => {
    const remove = jest.fn();
    const addEventListener = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockReturnValue({ remove });
    const handler = jest.fn(() => true);

    await renderHook(() => useFocusedHardwareBack(handler));

    expect(addEventListener).not.toHaveBeenCalled();
    const onFocus = mockUseFocusEffect.mock.calls[0][0] as () => () => void;
    const onBlur = onFocus();
    expect(addEventListener).toHaveBeenCalledWith(
      'hardwareBackPress',
      handler,
    );

    onBlur();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('처리할 단계가 없으면 포커스되어도 구독하지 않습니다', async () => {
    const addEventListener = jest.spyOn(BackHandler, 'addEventListener');

    await renderHook(() => useFocusedHardwareBack(undefined));

    const onFocus = mockUseFocusEffect.mock.calls[0][0] as () => undefined;
    expect(onFocus()).toBeUndefined();
    expect(addEventListener).not.toHaveBeenCalled();
  });
});
