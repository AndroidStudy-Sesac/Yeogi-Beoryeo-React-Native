import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NavigationState } from '@react-navigation/native';

import { createSearchSessionWriter, readSearchSession } from './searchSession';

const snapshot = { query: '종이', submittedQuery: '가', handledInitialQuery: null, resultVersion: 2, scrollOffset: 612 };
function navigationState(offset = 612, detail = true): NavigationState {
  const routes = [{ key: 'search', name: 'ItemSearch', params: { savedSearchState: { ...snapshot, scrollOffset: offset } } },
    ...(detail ? [{ key: 'detail', name: 'ItemGuideDetail', params: { guideId: 'item_001' } }] : [])];
  return { key: 'home', type: 'stack', stale: false, index: routes.length - 1,
    routeNames: ['ItemSearch', 'ItemGuideDetail'], routes };
}

function tabState(home = navigationState()): NavigationState {
  return { key: 'tabs', type: 'tab', stale: false, index: 0,
    routeNames: ['HomeTab', 'FavoritesTab'], routes: [
      { key: 'home-tab', name: 'HomeTab', state: home },
      { key: 'favorites-tab', name: 'FavoritesTab' },
    ] };
}

beforeEach(async () => { await AsyncStorage.clear(); jest.clearAllMocks(); });

it('같은 Android 작업이 복원되면 편집 입력, 제출 검색어, 스크롤과 상세 ID를 복원합니다', async () => {
  await createSearchSessionWriter('android-task-1')(tabState());
  const restored = await readSearchSession('android-task-1');
  expect(restored?.routes[0].name).toBe('HomeTab');
  expect(restored?.routes[0].state).toEqual({ index: 1, routes: [
    { name: 'ItemSearch', params: { savedSearchState: snapshot } },
    { name: 'ItemGuideDetail', params: { guideId: 'item_001', source: 'SEARCH' } },
  ] });
  expect(await readSearchSession('new-android-task')).toBeUndefined();
});

it('상세에서 돌아온 마지막 스크롤을 순서대로 저장하고 상세 화면을 다시 열지 않습니다', async () => {
  const write = createSearchSessionWriter('task');
  const first = write(tabState());
  const last = write(tabState(navigationState(900, false)));
  await Promise.all([first, last]);
  const restored = (await readSearchSession('task'))?.routes[0].state;
  expect(restored?.index).toBe(0);
  expect(restored?.routes).toHaveLength(1);
  expect(restored?.routes[0].params).toEqual({ savedSearchState: { ...snapshot, scrollOffset: 900 } });
});

it('상세를 읽던 위치도 검색 결과의 스크롤과 별도로 복원합니다', async () => {
  const state = navigationState();
  await createSearchSessionWriter('task')(tabState({ ...state, routes: state.routes.map(route =>
    route.name === 'ItemGuideDetail' ? { ...route, params: { guideId: 'item_001', scrollOffset: 500 } } : route) }));
  expect((await readSearchSession('task'))?.routes[0].state?.routes[1].params).toEqual({
    guideId: 'item_001', source: 'SEARCH', scrollOffset: 500,
  });
});

it('다른 탭의 상세 정보가 홈 검색의 복원 상태를 덮어쓰지 않습니다', async () => {
  const state = tabState(navigationState(300, false));
  state.routes[1] = { ...state.routes[1], state: {
    ...navigationState(), routes: [{ key: 'saved-detail', name: 'ItemGuideDetail',
      params: { guideId: 'another-item', source: 'FAVORITES', scrollOffset: 700 } }], index: 0,
  } };
  await createSearchSessionWriter('task')({ ...state, index: 1 });
  const home = (await readSearchSession('task'))?.routes[0].state;
  expect(home?.routes).toHaveLength(1);
  expect(home?.routes[0].params).toEqual({ savedSearchState: { ...snapshot, scrollOffset: 300 } });
});

it.each(['{broken', JSON.stringify({ sessionId: 'task', search: { ...snapshot, scrollOffset: -1 } }),
  JSON.stringify({ sessionId: 'task', search: { ...snapshot, resultVersion: 1.5 } }),
  JSON.stringify({ sessionId: 'task', search: snapshot, guideId: 42 }),
])('손상된 저장 상태는 앱 시작을 막지 않습니다: %s', async raw => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(raw);
  expect(await readSearchSession('task')).toBeUndefined();
});

it('저장소 오류 뒤에도 읽기가 끝나며 다음 저장을 수행할 수 있습니다', async () => {
  jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('read failed'));
  expect(await readSearchSession('task')).toBeUndefined();
  const write = createSearchSessionWriter('task');
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('write failed'));
  await write(tabState());
  await write(tabState(navigationState(100, false)));
  expect((await readSearchSession('task'))?.routes[0].state?.routes[0].params).toEqual({
    savedSearchState: { ...snapshot, scrollOffset: 100 },
  });
});
