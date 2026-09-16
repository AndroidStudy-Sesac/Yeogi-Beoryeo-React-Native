import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

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
  it('선택 경로와 세 폐기물 유형의 상세 안내를 표시합니다', async () => {
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
    expect(screen.getByLabelText('생활폐기물 배출 안내')).toBeOnTheScreen();
    expect(screen.getByLabelText('음식물쓰레기 배출 안내')).toBeOnTheScreen();
    expect(screen.getByLabelText('재활용품 배출 안내')).toBeOnTheScreen();
    expect(screen.getByText('18:00 ~ 23:00')).toBeOnTheScreen();
    expect(screen.getByText('종량제 봉투 배출')).toBeOnTheScreen();
  });

  it('최초 loading과 결과 없음 상태를 구분합니다', async () => {
    const deferred = deferredResult();
    await render(
      <RegionalGuideDetailScreen
        apiClient={clientReturningPromise(deferred.promise)}
        selection={selection}
      />,
    );

    expect(screen.getByLabelText('배출 안내 조회 중')).toBeOnTheScreen();
    deferred.resolve({ status: 'not-found' });

    await waitFor(() =>
      expect(screen.getByLabelText('배출 안내 결과 없음')).toBeOnTheScreen(),
    );
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

    await fireEvent.press(screen.getByLabelText('다시 조회'));

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
      { wasteType: 'recyclable' as const, disposalDays: '목' },
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
