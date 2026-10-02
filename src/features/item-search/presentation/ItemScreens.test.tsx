import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { ItemGuide } from '../domain/itemGuide';
import { ItemGuideDetailScreen } from './ItemGuideDetailScreen';
import { ItemSearchScreen } from './ItemSearchScreen';
import { getItemCategory, getItemDisplay, itemReadableText } from './itemDisplay';
import type { LoadItemGuide } from './useItemGuide';
import type { SearchItems } from './useItemSearch';
import { usesLargeItemTypography } from './itemTheme';

const milkCarton: ItemGuide = {
  id: 'test', name: '우유팩', legacyNames: [], categoryPaths: [['재활용폐기물', '종이팩 일반팩']],
  similarItems: [], dischargeMethods: ['종이팩으로 배출합니다.'],
  features: ['일반팩과 멸균팩이 있습니다.'], notes: ['내용물을 헹군 뒤 배출합니다.'],
};

describe('품목 화면', () => {
  it('검색 화면의 뒤로가기는 검색을 초기화하고 입력에 클릭 이벤트를 넣지 않습니다', async () => {
    const { getByRole, getByLabelText, queryByText } = await render(
      <ItemSearchScreen initialQuery="우유팩" searchItems={async () => [milkCarton]} onGuideSelected={jest.fn()} />,
    );
    await fireEvent.press(getByRole('button', { name: '뒤로가기' }), { nativeEvent: {} });
    expect(getByLabelText('품목 검색 창')).toHaveProp('value', '');
    expect(queryByText('‘우유팩’ 검색 결과 1개')).toBeNull();
  });

  it('검색 실패 뒤 재시도로 빈 결과 상태를 표시합니다', async () => {
    const searchItems = jest.fn<ReturnType<SearchItems>, Parameters<SearchItems>>()
      .mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce([]);
    const { getByLabelText, getByRole, queryByRole } = await render(
      <ItemSearchScreen onGuideSelected={jest.fn()} searchItems={searchItems} />,
    );
    await fireEvent.changeText(getByLabelText('품목 검색 창'), '없는 품목');
    await fireEvent.press(getByRole('button', { name: '검색' }));
    await waitFor(() => expect(getByRole('header', { name: '검색 결과를 불러오지 못했어요.' })).toBeTruthy());
    await fireEvent.press(getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(getByRole('header', { name: '검색 결과가 없어요.' })).toBeTruthy());
    expect(queryByRole('header', { name: '검색 결과를 불러오지 못했어요.' })).toBeNull();
    expect(searchItems.mock.calls.map(([query]) => query)).toEqual(['없는 품목', '없는 품목']);
  });

  it('검색 결과를 선택하면 품목 이름 대신 안정 ID를 전달합니다', async () => {
    const searchItems: SearchItems = async () => [milkCarton];
    const onGuideSelected = jest.fn();
    const { getByRole } = await render(<ItemSearchScreen initialQuery="우유팩"
      searchItems={searchItems} onGuideSelected={onGuideSelected} />);
    await fireEvent.press(getByRole('button', { name: '우유팩, 종이팩, 상세 보기' }));
    expect(onGuideSelected).toHaveBeenCalledWith('test');
  });

  it('상세 실패는 같은 ID로 재시도하고 원본 섹션과 문구를 표시합니다', async () => {
    const loadGuide = jest.fn<ReturnType<LoadItemGuide>, Parameters<LoadItemGuide>>()
      .mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce(milkCarton);
    const onBack = jest.fn();
    const { getByRole, getByLabelText, getAllByRole } = await render(
      <ItemGuideDetailScreen guideId="test" onBack={onBack} loadGuide={loadGuide} />,
    );
    expect(getByRole('header', { name: '품목 정보를 불러오지 못했어요' })).toBeTruthy();
    await fireEvent.press(getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(getByRole('header', { name: '우유팩' })).toBeTruthy());
    expect(getAllByRole('header').map(node => node.props.accessibilityLabel ?? node.props.children)).toEqual([
      '우유팩', '배출방법', '특징', '유의사항', '지역별 배출 기준 안내',
    ]);
    expect(getByLabelText('내용물을 헹군 뒤 배출합니다.')).toBeTruthy();
    expect(loadGuide.mock.calls.map(([id]) => id)).toEqual(['test', 'test']);
    await fireEvent.press(getByRole('button', { name: '뒤로가기' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('품목이 없으면 다시 선택하라는 안내와 뒤로가기를 제공합니다', async () => {
    const { getByLabelText, queryByRole } = await render(<ItemGuideDetailScreen guideId="missing"
      onBack={jest.fn()} loadGuide={async () => null} />);
    expect(getByLabelText('품목 가이드를 찾을 수 없습니다')).toBeTruthy();
    expect(getByLabelText('다시 검색해서 품목을 선택해 주세요.')).toBeTruthy();
    expect(queryByRole('button', { name: '다시 시도' })).toBeNull();
  });
});

describe('원본 품목 표시 규칙', () => {
  it.each<[number, boolean]>([[1.15, false], [1.2999999523162842, true], [1.5, true]])(
    'Android에서 전달한 글자 배율 %s에 원본의 큰 글자 분기를 적용합니다', (scale, expected) => {
      expect(usesLargeItemTypography(scale)).toBe(expected);
    },
  );
  it.each([
    ['EPS / PP', '이피에스 / 피피'], ['EPP, EPE, EPR', '이피피, 이피이, 이피알'],
    ['pe, Ps', '피이, 피에스'], ['STEPPER PE2 PPE', 'STEPPER 피이2 PPE'],
  ])('재질 약어 %s의 원본 접근성 발음을 보존합니다', (input, expected) => {
    expect(itemReadableText(input)).toBe(expected);
  });

  it.each([
    ['무색페트병', 'colorless_pet'], ['종이팩 일반팩', 'paper_pack'],
    ['전지류', 'battery'], ['조명제품', 'lighting'],
    ['불연성종량제폐기물', 'non_combustible'], ['공사장 생활폐기물', 'construction_waste'],
  ])('%s의 독립 카테고리를 보존합니다', (leaf, expected) => {
    expect(getItemCategory({ ...milkCarton, categoryPaths: [['상위 분류', leaf]] })).toBe(expected);
  });

  it('여러 경로에서는 유해폐기물과 일반종량제폐기물의 원본 우선순위를 지킵니다', () => {
    expect(getItemCategory({ ...milkCarton, categoryPaths: [['유리병'], ['폐의약품']] })).toBe('hazardous');
    expect(getItemCategory({ ...milkCarton, categoryPaths: [['대형폐기물'], ['일반종량제폐기물']] })).toBe('general_waste');
  });

  it('빈 상세 섹션은 표시하지 않고 배출방법의 목록 순서를 보존합니다', () => {
    const display = getItemDisplay({ ...milkCarton, dischargeMethods: ['방법 1', '방법 2'], features: [] });
    expect(display.sections).toEqual([
      { title: '배출방법', lines: ['방법 1', '방법 2'] },
      { title: '유의사항', lines: milkCarton.notes },
    ]);
    expect(display.categoryLabel).toBe('종이팩');
    expect(display.subcategory).toBe('우유팩');
    expect(display.disposalRoute).toBe('재활용 분리배출');
  });
});
