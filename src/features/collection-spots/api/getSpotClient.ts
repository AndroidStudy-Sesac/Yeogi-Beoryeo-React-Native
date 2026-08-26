import type { CollectionSpot } from '../model/CollectionSpot';
import { mapGetSpotItemsToCollectionSpots } from './getSpotMapper';
import type {
  GetSpotItemDto,
  GetSpotPageResult,
  GetSpotResponseDto,
} from './getSpotTypes';

export const GETSPOT_SERVICE_KEY_ENV_NAME =
  'EXPO_PUBLIC_GETSPOT_SERVICE_KEY';

const GETSPOT_ENDPOINT =
  'https://apis.data.go.kr/1482000/WasteRecyclingService/getSpot';
const DEFAULT_PAGE_NO = 1;
const DEFAULT_NUM_OF_ROWS = 100;
const RESULT_CODE_SUCCESS = '00';
const RESULT_CODE_NO_DATA = '03';
const LOCATION_SEARCH_ADDR_QUERY = ' ';
const LOCATION_MAX_PAGE_COUNT = 2;
const LOCATION_MAX_RESULT_COUNT = 120;

export type GetSpotSearchResult =
  | {
      ok: true;
      status: 'success' | 'empty';
      spots: CollectionSpot[];
      rawItems: GetSpotItemDto[];
      pageNo: number | null;
      numOfRows: number | null;
      totalCount: number | null;
      isPartial: boolean;
    }
  | {
      ok: false;
      status:
        | 'configuration-error'
        | 'network-error'
        | 'api-error'
        | 'parse-error'
        | 'cancelled';
      message: string;
      resultCode?: string;
      resultMsg?: string;
      httpStatus?: number;
    };

type GetSpotFailureResult = Extract<GetSpotSearchResult, { ok: false }>;

export type GetSpotClientConfig = {
  serviceKey?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

export type GetSpotAddressSearchParams = {
  address: string;
  pageNo?: number;
  numOfRows?: number;
  signal?: AbortSignal;
};

export type GetSpotLocationSearchParams = {
  latitude: number;
  longitude: number;
  radiusMeter: number;
  pageNo?: number;
  numOfRows?: number;
  signal?: AbortSignal;
};

type FetchSpotPageParams = {
  serviceKey: string;
  addr: string;
  pageNo: number;
  numOfRows: number;
  latitude?: number;
  longitude?: number;
  radius?: number;
  signal?: AbortSignal;
};

const getConfiguredServiceKey = () =>
  process.env.EXPO_PUBLIC_GETSPOT_SERVICE_KEY?.trim() ?? '';

const resolveServiceKey = (serviceKey?: string) =>
  serviceKey?.trim() || getConfiguredServiceKey();

const toIntOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);

    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const toItemList = (
  item: GetSpotResponseDto['response']['body']['items']
): GetSpotItemDto[] => {
  if (!item?.item) {
    return [];
  }

  return Array.isArray(item.item) ? item.item : [item.item];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isGetSpotResponseDto = (value: unknown): value is GetSpotResponseDto => {
  if (!isRecord(value) || !isRecord(value.response)) {
    return false;
  }

  const { header, body } = value.response;

  return (
    isRecord(header) &&
    isRecord(body) &&
    typeof header.resultCode === 'string' &&
    typeof header.resultMsg === 'string'
  );
};

const normalizeSpotPage = (
  data: GetSpotResponseDto
): GetSpotPageResult | GetSpotFailureResult => {
  const { header, body } = data.response;

  if (header.resultCode === RESULT_CODE_NO_DATA) {
    return {
      items: [],
      pageNo: toIntOrNull(body.pageNo),
      numOfRows: toIntOrNull(body.numOfRows),
      totalCount: toIntOrNull(body.totalCount),
    };
  }

  if (header.resultCode !== RESULT_CODE_SUCCESS) {
    return {
      ok: false,
      status: 'api-error',
      message: `수거 장소 API 오류(${header.resultCode}): ${header.resultMsg}`,
      resultCode: header.resultCode,
      resultMsg: header.resultMsg,
    };
  }

  return {
    items: toItemList(body.items),
    pageNo: toIntOrNull(body.pageNo),
    numOfRows: toIntOrNull(body.numOfRows),
    totalCount: toIntOrNull(body.totalCount),
  };
};

const isGetSpotErrorResult = (
  result: GetSpotPageResult | GetSpotFailureResult
): result is GetSpotFailureResult =>
  'ok' in result && result.ok === false;

const getTotalPages = (
  page: GetSpotPageResult,
  fallbackPageNo: number,
  fallbackNumOfRows: number
) => {
  const pageNo = page.pageNo ?? fallbackPageNo;
  const numOfRows = page.numOfRows ?? fallbackNumOfRows;

  if (page.totalCount === null || numOfRows <= 0) {
    return pageNo;
  }

  return Math.max(pageNo, Math.ceil(page.totalCount / numOfRows));
};

const toResult = (
  page: GetSpotPageResult,
  items: GetSpotItemDto[],
  isPartial: boolean
): GetSpotSearchResult => {
  const rawItems = dedupeItems(items);
  const spots = mapGetSpotItemsToCollectionSpots(rawItems);

  return {
    ok: true,
    status: spots.length === 0 ? 'empty' : 'success',
    spots,
    rawItems,
    pageNo: page.pageNo,
    numOfRows: page.numOfRows,
    totalCount: page.totalCount,
    isPartial,
  };
};

const toDedupKey = (item: GetSpotItemDto) =>
  [
    item.spotNm?.trim() ?? '',
    item.addrBase?.trim() ?? '',
    item.addrDtl?.trim() ?? '',
  ].join('\n');

const dedupeItems = (items: GetSpotItemDto[]) => {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = toDedupKey(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === 'AbortError';

export const createGetSpotClient = ({
  serviceKey,
  endpoint = GETSPOT_ENDPOINT,
  fetchImpl = fetch,
}: GetSpotClientConfig = {}) => {
  const fetchSpotPage = async ({
    serviceKey: requestServiceKey,
    addr,
    pageNo,
    numOfRows,
    latitude,
    longitude,
    radius,
    signal,
  }: FetchSpotPageParams): Promise<GetSpotPageResult | GetSpotFailureResult> => {
    const searchParams = new URLSearchParams({
      serviceKey: requestServiceKey,
      pageNo: String(pageNo),
      numOfRows: String(numOfRows),
      addr,
      _type: 'json',
    });

    if (latitude !== undefined) {
      searchParams.set('latitude', String(latitude));
    }

    if (longitude !== undefined) {
      searchParams.set('longitude', String(longitude));
    }

    if (radius !== undefined) {
      searchParams.set('radius', String(radius));
    }

    let response: Response;

    try {
      response = await fetchImpl(`${endpoint}?${searchParams}`, {
        signal,
      });
    } catch (error) {
      if (isAbortError(error)) {
        return {
          ok: false,
          status: 'cancelled',
          message: '수거 장소 API 요청이 취소되었습니다.',
        };
      }

      return {
        ok: false,
        status: 'network-error',
        message:
          error instanceof Error
            ? error.message
            : '수거 장소 API 네트워크 오류가 발생했습니다.',
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: 'network-error',
        message: `수거 장소 API HTTP 오류: ${response.status}`,
        httpStatus: response.status,
      };
    }

    let data: unknown;

    try {
      data = await response.json();
    } catch (error) {
      return {
        ok: false,
        status: 'parse-error',
        message:
          error instanceof Error
            ? error.message
            : '수거 장소 API 응답을 JSON으로 해석하지 못했습니다.',
      };
    }

    if (!isGetSpotResponseDto(data)) {
      return {
        ok: false,
        status: 'parse-error',
        message: '수거 장소 API 응답 형식이 예상과 다릅니다.',
      };
    }

    return normalizeSpotPage(data);
  };

  const searchByAddress = async ({
    address,
    pageNo = DEFAULT_PAGE_NO,
    numOfRows = DEFAULT_NUM_OF_ROWS,
    signal,
  }: GetSpotAddressSearchParams): Promise<GetSpotSearchResult> => {
    const requestServiceKey = resolveServiceKey(serviceKey);

    if (!requestServiceKey) {
      return {
        ok: false,
        status: 'configuration-error',
        message: `${GETSPOT_SERVICE_KEY_ENV_NAME} 값이 필요합니다.`,
      };
    }

    const firstPage = await fetchSpotPage({
      serviceKey: requestServiceKey,
      addr: address,
      pageNo,
      numOfRows,
      signal,
    });

    if (isGetSpotErrorResult(firstPage)) {
      return firstPage;
    }

    const totalPages = getTotalPages(firstPage, pageNo, numOfRows);
    const items = [...firstPage.items];
    let isPartial = false;

    for (
      let nextPageNo = (firstPage.pageNo ?? pageNo) + 1;
      nextPageNo <= totalPages;
      nextPageNo += 1
    ) {
      const nextPage = await fetchSpotPage({
        serviceKey: requestServiceKey,
        addr: address,
        pageNo: nextPageNo,
        numOfRows,
        signal,
      });

      if (isGetSpotErrorResult(nextPage)) {
        if (nextPage.status === 'cancelled') {
          return nextPage;
        }

        isPartial = true;
        break;
      }

      items.push(...nextPage.items);
    }

    return toResult(firstPage, items, isPartial);
  };

  const searchByLocation = async ({
    latitude,
    longitude,
    radiusMeter,
    pageNo = DEFAULT_PAGE_NO,
    numOfRows = DEFAULT_NUM_OF_ROWS,
    signal,
  }: GetSpotLocationSearchParams): Promise<GetSpotSearchResult> => {
    const requestServiceKey = resolveServiceKey(serviceKey);

    if (!requestServiceKey) {
      return {
        ok: false,
        status: 'configuration-error',
        message: `${GETSPOT_SERVICE_KEY_ENV_NAME} 값이 필요합니다.`,
      };
    }

    const firstPage = await fetchSpotPage({
      serviceKey: requestServiceKey,
      addr: LOCATION_SEARCH_ADDR_QUERY,
      pageNo,
      numOfRows,
      latitude,
      longitude,
      radius: radiusMeter,
      signal,
    });

    if (isGetSpotErrorResult(firstPage)) {
      return firstPage;
    }

    const totalPages = getTotalPages(firstPage, pageNo, numOfRows);
    const firstPageNo = firstPage.pageNo ?? pageNo;
    const lastPageNo = Math.min(
      totalPages,
      firstPageNo + LOCATION_MAX_PAGE_COUNT - 1
    );
    const items = [...firstPage.items];
    let isPartial = false;

    for (
      let nextPageNo = firstPageNo + 1;
      nextPageNo <= lastPageNo;
      nextPageNo += 1
    ) {
      const nextPage = await fetchSpotPage({
        serviceKey: requestServiceKey,
        addr: LOCATION_SEARCH_ADDR_QUERY,
        pageNo: nextPageNo,
        numOfRows,
        latitude,
        longitude,
        radius: radiusMeter,
        signal,
      });

      if (isGetSpotErrorResult(nextPage)) {
        if (nextPage.status === 'cancelled') {
          return nextPage;
        }

        isPartial = true;
        break;
      }

      items.push(...nextPage.items);
    }

    return toResult(
      firstPage,
      items.slice(0, LOCATION_MAX_RESULT_COUNT),
      isPartial
    );
  };

  return {
    searchByAddress,
    searchByLocation,
  };
};
