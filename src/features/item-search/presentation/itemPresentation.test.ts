import { act, renderHook } from '@testing-library/react-native';

import type { ItemGuide } from '../domain/itemGuide';
import { useItemGuide, type LoadItemGuide } from './useItemGuide';
import { useItemSearch, type ItemSearchSnapshot, type SearchItems } from './useItemSearch';

const battery: ItemGuide = {
  id: 'battery', name: '건전지', legacyNames: [], categoryPaths: [['전지류']],
  similarItems: [], dischargeMethods: ['전용 수거함에 배출하세요.'], features: [], notes: [],
};
const paper: ItemGuide = { ...battery, id: 'paper', name: '종이' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

function searchMock() {
  return jest.fn<ReturnType<SearchItems>, Parameters<SearchItems>>();
}

describe('품목 검색 상태', () => {
  it('입력만 편집하면 검색을 실행하지 않습니다', async () => {
    const searchItems = searchMock().mockResolvedValue([battery]);
    const { result } = await renderHook(() => useItemSearch({ searchItems }));
    await act(() => result.current.editQuery('건전지'));
    expect(searchItems).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ query: '건전지', status: 'idle', submittedQuery: null });
    await act(() => result.current.submit());
    expect(result.current).toMatchObject({ status: 'success', submittedQuery: '건전지', guides: [battery] });
  });

  it.each([
    { name: '검색 성공', guides: [battery] },
    { name: '빈 결과', guides: [] },
  ])('$name 상태와 제출 검색어를 입력 편집 뒤에도 유지합니다', async ({ guides }) => {
    const searchItems = searchMock().mockResolvedValue(guides);
    const { result } = await renderHook(() => useItemSearch({ searchItems }));
    await act(() => result.current.submit('건전지'));
    const completed = result.current;
    await act(() => result.current.editQuery('종이'));
    expect(result.current).toMatchObject({
      query: '종이', submittedQuery: '건전지', guides: completed.guides, status: completed.status,
    });
    expect(searchItems).toHaveBeenCalledTimes(1);
  });

  it.each(['success', 'failure'])('검색 중 편집하면 취소하고 늦은 %s를 무시합니다', async completion => {
    const pending = deferred<readonly ItemGuide[]>();
    const searchItems = searchMock().mockReturnValue(pending.promise);
    const { result } = await renderHook(() => useItemSearch({ searchItems }));
    await act(() => result.current.submit('건전지'));
    await act(() => result.current.editQuery('종이'));
    expect(searchItems.mock.calls[0][1].aborted).toBe(true);
    await act(() => completion === 'success' ? pending.resolve([battery]) : pending.reject(new Error('late')));
    expect(result.current).toMatchObject({ query: '종이', submittedQuery: null, status: 'idle', guides: [] });
  });

  it('연속 제출 시 이전 결과를 비우고 최신 요청만 반영합니다', async () => {
    const first = deferred<readonly ItemGuide[]>();
    const second = deferred<readonly ItemGuide[]>();
    const searchItems = searchMock().mockResolvedValueOnce([battery])
      .mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = await renderHook(() => useItemSearch({ searchItems }));
    await act(() => result.current.submit('건전지'));
    await act(() => result.current.submit('플라스틱'));
    expect(result.current).toMatchObject({ status: 'loading', guides: [] });
    await act(() => result.current.submit('종이'));
    await act(() => second.resolve([paper]));
    await act(() => first.resolve([battery]));
    expect(result.current).toMatchObject({ submittedQuery: '종이', guides: [paper], status: 'success' });
  });

  it('동일한 진행 중 검색과 재시도 연타는 한 번만 실행합니다', async () => {
    const first = deferred<readonly ItemGuide[]>();
    const retried = deferred<readonly ItemGuide[]>();
    const searchItems = searchMock().mockReturnValueOnce(first.promise).mockReturnValueOnce(retried.promise);
    const { result } = await renderHook(() => useItemSearch({ searchItems }));
    await act(() => { result.current.submit('건전지'); result.current.submit(' 건전지 '); });
    expect(searchItems).toHaveBeenCalledTimes(1);
    await act(() => first.reject(new Error('load failed')));
    expect(result.current.status).toBe('error');
    await act(() => { result.current.retry(); result.current.retry(); });
    expect(searchItems).toHaveBeenCalledTimes(2);
    expect(searchItems.mock.calls[1][0]).toBe('건전지');
    await act(() => retried.resolve([battery]));
    expect(result.current.status).toBe('success');
  });

  it('오류 뒤 입력을 편집하면 오류와 제출 상태를 초기화합니다', async () => {
    const searchItems = searchMock().mockRejectedValue(new Error('load failed'));
    const { result } = await renderHook(() => useItemSearch({ searchItems }));
    await act(() => result.current.submit('건전지'));
    await act(() => result.current.editQuery('종이'));
    await act(() => result.current.retry());
    expect(result.current).toMatchObject({ status: 'idle', submittedQuery: null, query: '종이' });
    expect(searchItems).toHaveBeenCalledTimes(1);
  });

  it.each(['clear', 'blank'])('%s 동작은 입력과 결과를 초기화하고 진행 중 요청을 취소합니다', async action => {
    const pending = deferred<readonly ItemGuide[]>();
    const searchItems = searchMock().mockReturnValue(pending.promise);
    const { result } = await renderHook(() => useItemSearch({ searchItems }));
    await act(() => result.current.submit('건전지'));
    await act(() => action === 'clear' ? result.current.clear() : result.current.submit('   '));
    expect(searchItems.mock.calls[0][1].aborted).toBe(true);
    await act(() => pending.resolve([battery]));
    expect(result.current).toMatchObject({ query: '', submittedQuery: null, status: 'idle', guides: [] });
  });

  it('초기 검색어는 한 번만 소비하고 새로 전달된 검색어는 반영합니다', async () => {
    const searchItems = searchMock().mockResolvedValue([battery]);
    const { result, rerender } = await renderHook(
      (initialQuery: string) => useItemSearch({ searchItems, initialQuery }),
      { initialProps: '건전지' },
    );
    await act(() => result.current.clear());
    await rerender('건전지');
    expect(searchItems).toHaveBeenCalledTimes(1);
    await rerender('종이');
    expect(searchItems).toHaveBeenCalledTimes(2);
    expect(result.current.query).toBe('종이');
  });

  it('재생성 시 제출 검색어로 조회하고 편집 입력과 목록 위치를 복원합니다', async () => {
    const searchItems = searchMock().mockResolvedValue([battery]);
    const onSnapshot = jest.fn<void, [ItemSearchSnapshot]>();
    const first = await renderHook(() => useItemSearch({ searchItems, initialQuery: '건전지', onSnapshot }));
    await act(() => { first.result.current.editQuery('종이'); first.result.current.rememberScroll(450); });
    const savedState = onSnapshot.mock.calls.at(-1)![0];
    await first.unmount();
    const restored = await renderHook(() => useItemSearch({ searchItems, initialQuery: '건전지', savedState }));
    expect(searchItems).toHaveBeenCalledTimes(2);
    expect(searchItems.mock.calls[1][0]).toBe('건전지');
    expect(restored.result.current).toMatchObject({ query: '종이', submittedQuery: '건전지', scrollOffset: 450, resultVersion: 1 });
    await act(() => restored.result.current.submit());
    expect(restored.result.current).toMatchObject({ query: '종이', submittedQuery: '종이', scrollOffset: 0, resultVersion: 2 });
  });

  it('제출하지 않은 입력은 복원해도 자동 검색하지 않습니다', async () => {
    const searchItems = searchMock();
    const savedState: ItemSearchSnapshot = {
      query: '편집 중', submittedQuery: null, handledInitialQuery: null, resultVersion: 0, scrollOffset: 0,
    };
    const { result } = await renderHook(() => useItemSearch({ searchItems, savedState }));
    expect(result.current).toMatchObject({ query: '편집 중', status: 'idle' });
    expect(searchItems).not.toHaveBeenCalled();
  });

  it('화면이 제거되면 진행 중 검색을 취소합니다', async () => {
    const pending = deferred<readonly ItemGuide[]>();
    const searchItems = searchMock().mockReturnValue(pending.promise);
    const { result, unmount } = await renderHook(() => useItemSearch({ searchItems }));
    await act(() => result.current.submit('건전지'));
    await unmount();
    expect(searchItems.mock.calls[0][1].aborted).toBe(true);
    await act(() => pending.resolve([battery]));
  });
});

describe('품목 상세 상태', () => {
  function detailMock() { return jest.fn<ReturnType<LoadItemGuide>, Parameters<LoadItemGuide>>(); }

  it('없는 품목과 로딩 실패를 구분하고 실패한 ID로 재시도합니다', async () => {
    const pending = deferred<ItemGuide | null>();
    const loadGuide = detailMock().mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('failed')).mockReturnValueOnce(pending.promise);
    const { result, rerender } = await renderHook((id: string) => useItemGuide(id, loadGuide), { initialProps: 'missing' });
    expect(result.current.status).toBe('not-found');
    await act(() => result.current.retry());
    expect(loadGuide).toHaveBeenCalledTimes(1);
    await rerender('battery');
    expect(result.current.status).toBe('error');
    await act(() => { result.current.retry(); result.current.retry(); });
    expect(loadGuide).toHaveBeenCalledTimes(3);
    expect(loadGuide.mock.calls[2][0]).toBe('battery');
    await act(() => pending.resolve(battery));
    expect(result.current).toMatchObject({ status: 'success', guide: battery });
  });

  it.each(['success', 'failure'])('ID 변경 뒤 이전 상세의 늦은 %s를 무시합니다', async completion => {
    const previous = deferred<ItemGuide | null>();
    const loadGuide = detailMock().mockReturnValueOnce(previous.promise).mockResolvedValueOnce(paper);
    const { result, rerender } = await renderHook((id: string) => useItemGuide(id, loadGuide), { initialProps: 'battery' });
    await rerender('paper');
    expect(loadGuide.mock.calls[0][1].aborted).toBe(true);
    await act(() => completion === 'success' ? previous.resolve(battery) : previous.reject(new Error('late')));
    expect(result.current).toMatchObject({ status: 'success', guide: paper });
  });

  it('같은 ID의 진행 중 요청을 중복 실행하지 않고 화면 제거 시 취소합니다', async () => {
    const pending = deferred<ItemGuide | null>();
    const loadGuide = detailMock().mockReturnValue(pending.promise);
    const { rerender, unmount } = await renderHook((id: string) => useItemGuide(id, loadGuide), { initialProps: 'battery' });
    await rerender('battery');
    expect(loadGuide).toHaveBeenCalledTimes(1);
    await unmount();
    expect(loadGuide.mock.calls[0][1].aborted).toBe(true);
    await act(() => pending.resolve(battery));
  });
});
