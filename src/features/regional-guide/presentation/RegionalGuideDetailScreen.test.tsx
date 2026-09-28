import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import type { RegionalGuideApiClient } from '../data/regionalGuideApi';
import type { RegionSelection } from '../domain/Region';
import type { RegionalGuideLookupResult } from '../domain/RegionalDisposalGuide';
import { RegionalGuideDetailScreen } from './RegionalGuideDetailScreen';

const selection: RegionSelection = {
  sido: { id: 'sido:11', level: 'sido', name: '서울특별시' },
  sigungu: {
    id: 'sigungu:11680',
    level: 'sigungu',
    name: '강남구',
    parentId: 'sido:11',
  },
  eupmyeondong: {
    id: 'eupmyeondong:1168064000',
    level: 'eupmyeondong',
    name: '역삼1동',
    parentId: 'sigungu:11680',
  },
};

describe('<RegionalGuideDetailScreen />', () => {
  it('Kotlin 앱과 같은 정보 구조로 선택 경로와 배출 안내를 표시합니다', async () => {
    await render(
      <RegionalGuideDetailScreen
        apiClient={clientReturning({
          status: 'success',
          guides: [guide()],
        })}
        selection={selection}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('배출 안내 조회 성공')).toBeOnTheScreen(),
    );
    expect(
      screen.getByLabelText('선택 지역: 서울특별시 > 강남구 > 역삼1동'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: '지역별 배출 가이드' })).toBeOnTheScreen();
    expect(screen.getByText('서울특별시 강남구 역삼1동')).toBeOnTheScreen();
    expect(screen.getByText('대상지역')).toBeOnTheScreen();
    expect(screen.getByText('장소설명')).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        '공공 안내에서 지자체 안내 링크 보기, 외부 공공 안내 페이지로 이동',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('배출 요일 및 시간')).toBeOnTheScreen();
    expect(screen.getByLabelText('일반쓰레기 배출 안내')).toBeOnTheScreen();
    expect(screen.getByLabelText('음식물쓰레기 배출 안내')).toBeOnTheScreen();
    expect(screen.getByLabelText('재활용품 배출 안내')).toBeOnTheScreen();
    expect(screen.getByText('18:00 ~ 23:00')).toBeOnTheScreen();
    expect(screen.getByText('20:00 이후')).toBeOnTheScreen();
    expect(screen.getByText('종량제 봉투 배출')).toBeOnTheScreen();
    expect(screen.queryByText('지정된 배출 방법이 없습니다.')).toBeNull();
  });

  it('제공된 일정만 표시하고 변경 동작으로 선택 화면에 돌아갑니다', async () => {
    const onBack = jest.fn();
    await render(
      <RegionalGuideDetailScreen
        apiClient={clientReturning({
          status: 'success',
          guides: [
            {
              targetRegionName: '역삼1동',
              schedules: [
                {
                  wasteType: 'general',
                  disposalDays: '월, 수',
                },
              ],
            },
          ],
        })}
        onBack={onBack}
        selection={selection}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('배출 안내 조회 성공')).toBeOnTheScreen(),
    );
    expect(screen.getByLabelText('일반쓰레기 배출 안내')).toBeOnTheScreen();
    expect(screen.queryByLabelText('음식물쓰레기 배출 안내')).toBeNull();
    expect(screen.queryByLabelText('재활용품 배출 안내')).toBeNull();

    fireEvent.press(screen.getByLabelText('지역 변경'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('일치하는 안내가 여러 건이면 임의 표시하지 않고 후보 선택을 제공합니다', async () => {
    const first = {
      ...guide(),
      managementZoneName: '1권역',
      disposalPlace: '1권역 배출장',
    };
    const second = {
      ...guide(),
      managementZoneName: '2권역',
      disposalPlace: '2권역 배출장',
    };
    await render(
      <RegionalGuideDetailScreen
        apiClient={clientReturning({
          status: 'success',
          guides: [first, second],
        })}
        selection={selection}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText('적용 가능한 배출 안내 후보'),
      ).toBeOnTheScreen(),
    );
    fireEvent.press(
      screen.getByLabelText('배출 안내 후보 2: 2권역 / 역삼1동'),
    );

    await waitFor(() =>
      expect(screen.getByLabelText('배출 안내 조회 성공')).toBeOnTheScreen(),
    );
    expect(screen.getByText('2권역 배출장')).toBeOnTheScreen();
    expect(screen.queryByText('1권역 배출장')).not.toBeOnTheScreen();
  });

  it('후보 목록을 제한된 높이로 스크롤하고 후보 상세의 뒤로가기로 목록을 복원합니다', async () => {
    let candidateBackHandler: (() => boolean) | undefined;
    const first = {
      ...guide(),
      managementZoneName: '1권역',
      disposalPlace: '1권역 배출장',
    };
    const second = {
      ...guide(),
      managementZoneName: '2권역',
      disposalPlace: '2권역 배출장',
    };
    await render(
      <RegionalGuideDetailScreen
        apiClient={clientReturning({
          status: 'success',
          guides: [first, second],
        })}
        onCandidateBackHandlerChange={handler => {
          candidateBackHandler = handler;
        }}
        selection={selection}
      />,
    );

    const candidateList = await screen.findByLabelText(
      '배출 안내 후보 목록, 2개',
    );
    expect(candidateList).toHaveStyle({ maxHeight: 260 });
    await fireEvent.scroll(candidateList, {
      nativeEvent: { contentOffset: { x: 0, y: 84 } },
    });
    await fireEvent.press(
      screen.getByLabelText('배출 안내 후보 1: 1권역 / 역삼1동'),
    );

    await waitFor(() => expect(candidateBackHandler).toBeDefined());
    await act(async () => {
      expect(candidateBackHandler?.()).toBe(true);
    });

    await waitFor(() =>
      expect(
        screen.getByLabelText('배출 안내 후보 목록, 2개'),
      ).toBeOnTheScreen(),
    );
  });

  it('직접 안내가 없으면 Kotlin 앱과 같은 시군구 수거 유형 선택 안내를 표시합니다', async () => {
    const fallbackSelection: RegionSelection = {
      sido: { id: 'sido:42', level: 'sido', name: '강원특별자치도' },
      sigungu: {
        id: 'sigungu:42150',
        level: 'sigungu',
        name: '강릉시',
        parentId: 'sido:42',
      },
      eupmyeondong: {
        id: 'eupmyeondong:4215034000',
        level: 'eupmyeondong',
        name: '사천면',
        parentId: 'sigungu:42150',
      },
    };
    await render(
      <RegionalGuideDetailScreen
        apiClient={clientReturning({
          status: 'success',
          guides: [
            {
              sidoName: '강원특별자치도',
              sigunguName: '강릉시',
              disposalPlaceType: '문전수거',
              targetRegionName: '없음',
              schedules: [],
            },
            {
              sidoName: '강원특별자치도',
              sigunguName: '강릉시',
              disposalPlaceType: '거점수거',
              targetRegionName: '없음',
              schedules: [],
            },
          ],
        })}
        selection={fallbackSelection}
      />,
    );

    expect(
      await screen.findByText(
        '사천면의 직접 배출 안내가 없어 강릉시 기준 수거 유형을 선택해 주세요.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        /배출 안내 후보 \d+: 문전수거, 집 앞 또는 지정된 배출장소에 배출하는 지역/,
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText(/선택 지역:/)).toBeNull();
  });

  it('최초 loading과 결과 없음 상태를 구분합니다', async () => {
    const deferred = deferredResult();
    const onBack = jest.fn();
    await render(
      <RegionalGuideDetailScreen
        apiClient={clientReturningPromise(deferred.promise)}
        onBack={onBack}
        selection={selection}
      />,
    );

    expect(screen.getByLabelText('배출 안내 조회 중')).toBeOnTheScreen();
    deferred.resolve({ status: 'not-found' });

    await waitFor(() =>
      expect(screen.getByLabelText('배출 안내 결과 없음')).toBeOnTheScreen(),
    );
    fireEvent.press(screen.getByLabelText('지역 다시 선택하기'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('완전한 조회에서 선택 읍면동 안내가 없으면 미제공으로 표시합니다', async () => {
    await render(
      <RegionalGuideDetailScreen
        apiClient={clientReturning({
          status: 'success',
          guides: [{ targetRegionName: '삼성동', schedules: [] }],
        })}
        selection={selection}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText('선택 지역 배출 안내 미제공'),
      ).toBeOnTheScreen(),
    );
  });

  it('partial 안내를 유지하고 전체 결과 재조회를 제공합니다', async () => {
    await render(
      <RegionalGuideDetailScreen
        apiClient={clientReturning({
          status: 'partial',
          guides: [guide()],
          metadata: {
            reason: 'timeout',
            fetchedPageCount: 1,
            receivedItemCount: 1,
            totalCount: 2,
            failedPageNo: 2,
            duplicateGuideCount: 0,
          },
        })}
        selection={selection}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText('배출 안내 부분 조회 성공'),
      ).toBeOnTheScreen(),
    );
    expect(screen.getByLabelText('전체 배출 안내 다시 조회')).toBeOnTheScreen();
    expect(screen.getByText('중단 사유: 시간 초과')).toBeOnTheScreen();
    expect(screen.getByText('종량제 봉투 배출')).toBeOnTheScreen();
  });

  it.each([
    ['timeout' as const, '배출 안내 조회 실패: 시간 초과'],
    ['network' as const, '배출 안내 조회 실패: 네트워크 오류'],
    ['api' as const, '배출 안내 조회 실패: API 오류'],
  ])('%s 오류 후 재조회하면 정상 상태로 복구합니다', async (reason, label) => {
    const client: RegionalGuideApiClient = {
      fetchRegionalDisposalGuides: jest
        .fn()
        .mockResolvedValueOnce({ status: 'failure', reason })
        .mockResolvedValueOnce({ status: 'success', guides: [guide()] }),
      clearCache: jest.fn(),
    };
    await render(
      <RegionalGuideDetailScreen apiClient={client} selection={selection} />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText(label)).toBeOnTheScreen(),
    );

    await fireEvent.press(screen.getByLabelText('다시 시도'));

    await waitFor(() =>
      expect(screen.getByLabelText('배출 안내 조회 성공')).toBeOnTheScreen(),
    );
    expect(client.fetchRegionalDisposalGuides).toHaveBeenCalledTimes(2);
  });
});

function guide() {
  return {
    targetRegionName: '역삼1동',
    disposalPlace: '내 집 앞',
    schedules: [
      {
        wasteType: 'general' as const,
        disposalDays: '월, 수',
        disposalStartTime: '18:00',
        disposalEndTime: '23:00',
        disposalMethod: '종량제 봉투 배출',
      },
      { wasteType: 'food' as const, disposalDays: '매일' },
      {
        wasteType: 'recyclable' as const,
        disposalDays: '목',
        disposalStartTime: '20:00',
      },
    ],
  };
}

function clientReturning(result: RegionalGuideLookupResult): RegionalGuideApiClient {
  return clientReturningPromise(Promise.resolve(result));
}

function clientReturningPromise(
  result: Promise<RegionalGuideLookupResult>,
): RegionalGuideApiClient {
  return {
    fetchRegionalDisposalGuides: jest.fn(() => result),
    clearCache: jest.fn(),
  };
}

function deferredResult() {
  let resolve!: (result: RegionalGuideLookupResult) => void;
  const promise = new Promise<RegionalGuideLookupResult>(promiseResolve => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}
