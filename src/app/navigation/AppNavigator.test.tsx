import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { Button, Text, View } from 'react-native';

import { AppProviders } from '../providers/AppProviders';
import {
  AppNavigator,
  type AppScreenRegistry,
  useBottomTabBarVisibility,
} from './AppNavigator';
import {
  APP_SCREEN_ROUTES,
  BOTTOM_TAB_ROUTES,
  type AppTabParamList,
  type FavoritesStackParamList,
  type HomeStackParamList,
  type MapStackParamList,
} from './routes';

jest.useFakeTimers();

function ItemSearchTestScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const [count, setCount] = useState(0);

  return (
    <View>
      <Text>품목 검색 테스트 화면</Text>
      <Text>{`검색 상태 ${count}`}</Text>
      <Button onPress={() => setCount(value => value + 1)} title="상태 변경" />
      <Button
        onPress={() =>
          navigation.navigate('ItemGuideDetail', {
            guideId: 'glass',
            source: 'SEARCH',
          })
        }
        title="품목 상세 열기"
      />
    </View>
  );
}

function ItemGuideDetailTestScreen() {
  const navigation = useNavigation();

  return (
    <View>
      <Text>품목 상세 테스트 화면</Text>
      <Button onPress={() => navigation.goBack()} title="뒤로가기" />
    </View>
  );
}

function MapTestScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MapStackParamList>>();
  const [isBottomTabBarVisible, setBottomTabBarVisible] = useState(true);
  useBottomTabBarVisibility(isBottomTabBarVisible);

  return (
    <View>
      <Text>지도 테스트 화면</Text>
      <Button
        onPress={() => setBottomTabBarVisible(false)}
        title="하단 탭 숨기기"
      />
      <Button
        onPress={() =>
          navigation
            .getParent<BottomTabNavigationProp<AppTabParamList>>()
            ?.navigate(BOTTOM_TAB_ROUTES.HOME)
        }
        title="홈으로 이동"
      />
      <Button
        onPress={() =>
          navigation.navigate(APP_SCREEN_ROUTES.REGIONAL_GUIDE, {
            initialAddress: '서울특별시 중구',
          })
        }
        title="지역 안내 열기"
      />
    </View>
  );
}

function RegionalGuideTestScreen() {
  const navigation = useNavigation();

  return (
    <View>
      <Text>지역 안내 테스트 화면</Text>
      <Button onPress={() => navigation.goBack()} title="뒤로가기" />
    </View>
  );
}

function FavoritesTestScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<FavoritesStackParamList>>();

  return (
    <View>
      <Text>저장 테스트 화면</Text>
      <Button
        onPress={() =>
          navigation.navigate(APP_SCREEN_ROUTES.ITEM_GUIDE_DETAIL, {
            guideId: 'glass',
            source: 'FAVORITES',
          })
        }
        title="저장 품목 상세 열기"
      />
    </View>
  );
}

function UnusedTestScreen() {
  return <Text>보조 테스트 화면</Text>;
}

const screens: AppScreenRegistry = {
  Favorites: FavoritesTestScreen,
  ItemGuideDetail: ItemGuideDetailTestScreen,
  ItemSearch: ItemSearchTestScreen,
  ItemUsefulGuide: UnusedTestScreen,
  Map: MapTestScreen,
  QuickCategorySettings: UnusedTestScreen,
  RegionalGuide: RegionalGuideTestScreen,
  Settings: UnusedTestScreen,
  SettingsDetail: UnusedTestScreen,
};

async function renderNavigator() {
  return render(
    <AppProviders>
      <AppNavigator screens={screens} />
    </AppProviders>,
  );
}

describe('<AppNavigator />', () => {
  it('홈, 지도, 안내, 저장 탭을 원본 순서로 표시합니다', async () => {
    const { getAllByRole, getAllByTestId, getByText, queryByText } =
      await renderNavigator();

    await waitFor(() => expect(getByText('품목 검색 테스트 화면')).toBeTruthy());

    expect(
      getAllByRole('button', { name: / 탭$/ }).map(
        tab => tab.props.accessibilityLabel,
      ),
    ).toEqual(['홈 탭', '지도 탭', '안내 탭', '저장 탭']);
    Object.values(BOTTOM_TAB_ROUTES).forEach(routeName => {
      expect(getAllByTestId(`bottom-tab-icon-${routeName}`).length).toBeGreaterThan(
        0,
      );
    });
    expect(queryByText('⏷')).toBeNull();
  });

  it('다른 탭에 다녀와도 기존 탭의 화면 상태를 복원합니다', async () => {
    const { getByRole, getByText } = await renderNavigator();

    await waitFor(() => expect(getByText('검색 상태 0')).toBeTruthy());
    await fireEvent.press(getByRole('button', { name: '상태 변경' }));
    await fireEvent.press(getByRole('button', { name: '지도 탭' }));
    await waitFor(() => expect(getByText('지도 테스트 화면')).toBeTruthy());

    await fireEvent.press(getByRole('button', { name: '홈 탭' }));

    await waitFor(() => expect(getByText('검색 상태 1')).toBeTruthy());
  });

  it('선택된 탭을 다시 누르면 해당 stack의 첫 화면으로 돌아갑니다', async () => {
    const { getByRole, getByText, queryByText } = await renderNavigator();

    await waitFor(() => expect(getByText('품목 검색 테스트 화면')).toBeTruthy());
    await fireEvent.press(getByRole('button', { name: '품목 상세 열기' }));
    await waitFor(() => expect(getByText('품목 상세 테스트 화면')).toBeTruthy());

    await fireEvent.press(getByRole('button', { name: '홈 탭' }));

    await waitFor(() => expect(getByText('품목 검색 테스트 화면')).toBeTruthy());
    expect(queryByText('품목 상세 테스트 화면')).toBeNull();
  });

  it('저장에서 연 품목 상세의 뒤로가기는 저장 화면으로 복귀합니다', async () => {
    const { getByRole, getByText } = await renderNavigator();

    await fireEvent.press(getByRole('button', { name: '저장 탭' }));
    await fireEvent.press(
      getByRole('button', { name: '저장 품목 상세 열기' }),
    );
    await waitFor(() => expect(getByText('품목 상세 테스트 화면')).toBeTruthy());
    expect(
      getByRole('button', { name: '저장 탭' }).props.accessibilityState,
    ).toMatchObject({ selected: true });

    await fireEvent.press(getByRole('button', { name: '뒤로가기' }));

    await waitFor(() => expect(getByText('저장 테스트 화면')).toBeTruthy());
  });

  it('지도에서 연 지역 안내의 뒤로가기는 지도 화면으로 복귀합니다', async () => {
    const { getByRole, getByText } = await renderNavigator();

    await fireEvent.press(getByRole('button', { name: '지도 탭' }));
    await fireEvent.press(getByRole('button', { name: '지역 안내 열기' }));
    await waitFor(() => expect(getByText('지역 안내 테스트 화면')).toBeTruthy());
    expect(
      getByRole('button', { name: '지도 탭' }).props.accessibilityState,
    ).toMatchObject({ selected: true });

    await fireEvent.press(getByRole('button', { name: '뒤로가기' }));

    await waitFor(() => expect(getByText('지도 테스트 화면')).toBeTruthy());
  });

  it('현재 화면이 요청한 하단 탭 표시 상태를 적용하고 이탈 시 복원합니다', async () => {
    const { getByRole, getByText, queryByRole } = await renderNavigator();

    await fireEvent.press(getByRole('button', { name: '지도 탭' }));
    await waitFor(() => expect(getByText('지도 테스트 화면')).toBeTruthy());
    await fireEvent.press(getByRole('button', { name: '하단 탭 숨기기' }));

    await waitFor(() =>
      expect(queryByRole('button', { name: '홈 탭' })).toBeNull(),
    );
    await fireEvent.press(getByRole('button', { name: '홈으로 이동' }));

    await waitFor(() => expect(getByText('품목 검색 테스트 화면')).toBeTruthy());
    expect(getByRole('button', { name: '홈 탭' })).toBeTruthy();
  });
});
