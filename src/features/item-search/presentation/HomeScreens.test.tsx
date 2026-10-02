import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking, Text } from 'react-native';

import { ItemPreferencesStore } from '../data/itemPreferences';
import { HomeContent } from './HomeContent';
import { ItemGuideDetailScreen } from './ItemGuideDetailScreen';
import { ItemPreferencesProvider } from './ItemPreferencesContext';
import { QuickCategorySettingsScreen } from './QuickCategorySettingsScreen';
import { ItemFavoritesScreen, ItemPreferenceFeedback } from './ItemFavoritesScreen';
import { ItemUsefulGuideScreen } from './ItemUsefulGuideScreen';
import { homeCollapsedCount, homeGridMetrics } from './homeLayout';
import { loadItemGuide } from '../data/itemCatalog';
import { itemDetailActions } from './itemDetailActions';

const backend = () => ({ getItem: jest.fn(async () => null as string | null), setItem: jest.fn(async () => {}) });

test('home expands every category and opens its representative stable ID', async () => {
  const store = new ItemPreferencesStore(backend());
  const onGuideSelected = jest.fn();
  const view = await render(<ItemPreferencesProvider store={store}><HomeContent searchField={<Text>검색 필드</Text>}
    onGuideSelected={onGuideSelected} onCategorySettings={jest.fn()} onUsefulGuide={jest.fn()} /></ItemPreferencesProvider>);
  expect(view.getByRole('header', { name: '안내 사항' })).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: '더보기' }));
  await fireEvent.press(view.getByRole('button', { name: '생활계 유해폐기물 배출 방법 보기' }));
  expect(onGuideSelected).toHaveBeenCalledWith('item-guide-0018');
  await fireEvent.press(view.getByRole('button', { name: '접기' }));
  expect(view.getByRole('button', { name: '더보기' })).toBeTruthy();
});

test('category editing enforces its limit and back first clears the query', async () => {
  const store = new ItemPreferencesStore(backend());
  const onBack = jest.fn();
  const view = await render(<ItemPreferencesProvider store={store}>
    <QuickCategorySettingsScreen maximum={1} onBack={onBack} /></ItemPreferencesProvider>);
  await fireEvent.press(view.getByRole('checkbox', { name: '종이' }));
  await waitFor(() => expect(view.getByRole('checkbox', { name: '종이' })).toHaveProp('accessibilityState', { checked: true, disabled: false }));
  await fireEvent.press(view.getByRole('checkbox', { name: '종이팩' }));
  expect(view.getByText('최대 1개까지만 선택할 수 있어요.')).toBeTruthy();
  await fireEvent.changeText(view.getByLabelText('분류 검색'), '의류 및원단');
  expect(view.getByRole('checkbox', { name: '의류 및 원단' })).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: '뒤로가기' }));
  expect(view.getByLabelText('분류 검색')).toHaveProp('value', '');
  expect(onBack).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button', { name: '뒤로가기' }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('favorites use stable IDs and preserve saved entries when removing fails', async () => {
  const storage = backend();
  const store = new ItemPreferencesStore(storage);
  await store.load();
  await store.toggleFavorite('item-guide-0001');
  const open = jest.fn();
  const view = await render(<ItemPreferencesProvider store={store}>
    <ItemFavoritesScreen onGuideSelected={open} /><ItemPreferenceFeedback /></ItemPreferencesProvider>);
  await fireEvent.press(view.getByRole('button', { name: '종이 상세 보기' }));
  expect(open).toHaveBeenCalledWith('item-guide-0001');
  storage.setItem.mockRejectedValueOnce(new Error('write failed'));
  await fireEvent.press(view.getByRole('button', { name: '종이 즐겨찾기 해제' }));
  await waitFor(() => expect(view.getByRole('button', { name: '종이 상세 보기' })).toBeTruthy());
  expect(view.getByText('변경사항을 저장하지 못했어요. 다시 시도해 주세요.')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: '종이 즐겨찾기 해제' }));
  await waitFor(() => expect(view.getByLabelText('아직 즐겨찾기한 품목이 없어요')).toBeTruthy());
});

test('representative details render table rows and recycling category correctly', async () => {
  const view = await render(<ItemGuideDetailScreen guideId="item-guide-0008" onBack={jest.fn()} />);
  expect(view.getByRole('header', { name: '금속류' })).toBeTruthy();
  expect(view.getByRole('header', { name: '품목별 배출 방법' })).toBeTruthy();
  expect(view.getByLabelText('금속캔')).toBeTruthy();
});

test('useful guide opens its action and reports external link failure', async () => {
  const onAction = jest.fn();
  const open = jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(new Error('no handler'));
  const view = await render(<ItemUsefulGuideScreen type="SMALL_E_WASTE" onAction={onAction} onBack={jest.fn()} />);
  await fireEvent.press(view.getByRole('button', { name: '근처 중소형 수거함 찾기' }));
  expect(onAction).toHaveBeenCalledWith('SMALL_E_WASTE');
  await fireEvent.press(view.getByRole('link', { name: '무상방문수거 안내 보기' }));
  expect(view.getByText('링크를 열지 못했어요. 다시 시도해 주세요.')).toBeTruthy();
  open.mockRestore();
});

test('electronic representative preserves collection actions and passes the requested map type', async () => {
  const actions = itemDetailActions(loadItemGuide('item-guide-0012')!);
  expect(actions.filter(action => 'spot' in action).map(action => 'spot' in action && action.spot))
    .toEqual(['SMALL_E_WASTE_BIN', 'PHONE_DROP_OFF']);
  expect(actions.at(-1)).toMatchObject({ url: 'https://www.15990903.or.kr/portal/cnts/userGuide.do' });
  const onMap = jest.fn();
  const view = await render(<ItemGuideDetailScreen guideId="item-guide-0010" onBack={jest.fn()} onMap={onMap} />);
  await fireEvent.press(view.getByRole('button', { name: '근처 폐건전지 수거함 찾기' }));
  expect(onMap).toHaveBeenCalledWith('BATTERY_BIN');
});

test('home expanded state and page survive remounting', async () => {
  const store = new ItemPreferencesStore(backend());
  const remember = jest.fn();
  const callbacks = { onGuideSelected: jest.fn(), onCategorySettings: jest.fn(), onUsefulGuide: jest.fn() };
  const view = await render(<ItemPreferencesProvider store={store}><HomeContent {...callbacks} searchField={<Text>검색</Text>}
    onSnapshot={remember} savedState={{ expanded: true, guidePage: 2, collapsedCount: 8, scrollOffset: 0, collapsedScrollOffset: 0 }} />
  </ItemPreferencesProvider>);
  expect(view.getByLabelText('안내 3/4')).toBeTruthy();
  expect(view.getByRole('button', { name: '생활계 유해폐기물 배출 방법 보기' })).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: '접기' }));
  expect(remember).toHaveBeenLastCalledWith(expect.objectContaining({ expanded: false, guidePage: 2 }));
});

test('failed restore can be retried without enabling writes prematurely', async () => {
  const storage = backend();
  storage.getItem.mockRejectedValueOnce(new Error('read failed'));
  const store = new ItemPreferencesStore(storage);
  const view = await render(<ItemPreferencesProvider store={store}>
    <ItemFavoritesScreen onGuideSelected={jest.fn()} /></ItemPreferencesProvider>);
  expect(view.getByLabelText('즐겨찾기를 불러오지 못했어요')).toBeTruthy();
  await act(async () => { expect(await store.toggleFavorite('item-guide-0001')).toBe(false); });
  await fireEvent.press(view.getByRole('button', { name: '다시 시도' }));
  await waitFor(() => expect(view.getByLabelText('아직 즐겨찾기한 품목이 없어요')).toBeTruthy());
});

test('grid responds to narrow screens and the original 130 percent float boundary', () => {
  expect(homeGridMetrics(280, 1.2999999523162842).columns).toBe(2);
  expect(homeGridMetrics(360, 1).columns).toBe(4);
  expect(homeCollapsedCount(4, 0, 112, 16)).toBe(8);
  expect(homeCollapsedCount(4, 270, 112, 16)).toBe(8);
});
