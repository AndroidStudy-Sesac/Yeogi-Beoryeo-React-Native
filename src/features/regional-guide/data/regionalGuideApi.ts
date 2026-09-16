import type {
  RegionalDisposalGuide,
  RegionalGuideFailureReason,
  RegionalGuideLookupResult,
  RegionalGuidePartialResultMetadata,
  RegionalGuidePartialResultReason,
  RegionalWasteSchedule,
  RegionalWasteType,
} from '../domain/RegionalDisposalGuide';

const PAGE_SIZE = 100;
const MAX_CACHE_ENTRY_COUNT = 5;

export type RegionalGuideRecoveryPolicy = Readonly<{
  pageTimeoutMs: number;
  totalTimeoutMs: number;
  maxPageCount: number;
}>;

export const DEFAULT_REGIONAL_GUIDE_RECOVERY_POLICY: RegionalGuideRecoveryPolicy =
  {
    pageTimeoutMs: 2_000,
    totalTimeoutMs: 5_000,
    maxPageCount: 5,
  };

export type RegionalGuideApiConfig = Readonly<{
  endpoint?: string;
}>;

type FetchRequester = (
  input: string,
  init?: { signal?: AbortSignal },
) => Promise<Response>;

export type RegionalGuideApiClient = Readonly<{
  fetchRegionalDisposalGuides(
    sigunguName: string,
    signal?: AbortSignal,
  ): Promise<RegionalGuideLookupResult>;
  clearCache(sigunguName?: string): void;
}>;

export function getRegionalGuideApiConfig(): RegionalGuideApiConfig {
  return {
    endpoint: normalizeText(process.env.EXPO_PUBLIC_REGIONAL_GUIDE_API_URL),
  };
}

export function createRegionalGuideApiConfig(
  environment: Record<string, string | undefined>,
): RegionalGuideApiConfig {
  return {
    endpoint: normalizeText(environment.EXPO_PUBLIC_REGIONAL_GUIDE_API_URL),
  };
}

export function createRegionalGuideApiClient(
  config: RegionalGuideApiConfig = getRegionalGuideApiConfig(),
  request: FetchRequester = fetch,
  recoveryPolicy: RegionalGuideRecoveryPolicy =
    DEFAULT_REGIONAL_GUIDE_RECOVERY_POLICY,
): RegionalGuideApiClient {
  const completeResultCache = new Map<string, CompleteRegionalGuideLookupResult>();

  return {
    async fetchRegionalDisposalGuides(sigunguName, signal) {
      throwIfAborted(signal);
      const cacheKey = normalizeText(sigunguName) ?? '';
      const cached = completeResultCache.get(cacheKey);
      if (cached) {
        completeResultCache.delete(cacheKey);
        completeResultCache.set(cacheKey, cached);
        return cached;
      }

      const result = await fetchRegionalDisposalGuides(
        sigunguName,
        config,
        signal,
        request,
        recoveryPolicy,
      );
      if (result.status === 'success' || result.status === 'not-found') {
        completeResultCache.set(cacheKey, result);
        while (completeResultCache.size > MAX_CACHE_ENTRY_COUNT) {
          const oldestKey = completeResultCache.keys().next().value;
          if (oldestKey === undefined) break;
          completeResultCache.delete(oldestKey);
        }
      }
      return result;
    },
    clearCache(sigunguName) {
      const cacheKey = normalizeText(sigunguName);
      if (cacheKey) completeResultCache.delete(cacheKey);
      else completeResultCache.clear();
    },
  };
}

export async function fetchRegionalDisposalGuides(
  sigunguName: string,
  config: RegionalGuideApiConfig,
  signal?: AbortSignal,
  request: FetchRequester = fetch,
  recoveryPolicy: RegionalGuideRecoveryPolicy =
    DEFAULT_REGIONAL_GUIDE_RECOVERY_POLICY,
): Promise<RegionalGuideLookupResult> {
  throwIfAborted(signal);

  const normalizedSigunguName = normalizeText(sigunguName);
  const endpoint = normalizeEndpoint(config.endpoint);
  if (!normalizedSigunguName || !endpoint) {
    return { status: 'failure', reason: 'configuration' };
  }

  try {
    const pageResult = await fetchAllPages(
      normalizedSigunguName,
      endpoint,
      signal,
      request,
      normalizeRecoveryPolicy(recoveryPolicy),
    );
    const mappedGuides = pageResult.items
      .map(mapRegionalGuideItem)
      .filter((guide): guide is RegionalDisposalGuide => guide !== undefined);
    const guides = distinctGuides(mappedGuides);

    if (pageResult.partialMetadata) {
      return {
        status: 'partial',
        guides,
        metadata: {
          ...pageResult.partialMetadata,
          duplicateGuideCount: mappedGuides.length - guides.length,
        },
      };
    }

    return guides.length > 0
      ? { status: 'success', guides }
      : { status: 'not-found' };
  } catch (error) {
    if (signal?.aborted) throw abortReason(signal);
    if (isAbortError(error)) throw error;
    return { status: 'failure', reason: classifyFailure(error) };
  }
}

export function mapRegionalGuideItem(
  item: unknown,
): RegionalDisposalGuide | undefined {
  if (!isRecord(item)) return undefined;

  const guide: RegionalDisposalGuide = {
    sidoName: readText(item, 'CTPV_NM'),
    sigunguName: readText(item, 'SGG_NM'),
    managementZoneName: readText(item, 'MNG_ZONE_NM'),
    targetRegionName: readText(item, 'MNG_ZONE_TRGT_RGN_NM'),
    disposalPlaceType: readText(item, 'EMSN_PLC_TYPE'),
    disposalPlace: readText(item, 'EMSN_PLC'),
    uncollectedDays: normalizeDays(readText(item, 'UNCLLT_DAY')),
    schedules: [
      createSchedule('general', item, 'LF_WST'),
      createSchedule('food', item, 'FOD_WST'),
      createSchedule('recyclable', item, 'RCYCL'),
    ].filter(
      (schedule): schedule is RegionalWasteSchedule => schedule !== undefined,
    ),
    departmentName: readText(item, 'MNG_DEPT_NM'),
    departmentPhoneNumber: readText(item, 'MNG_DEPT_TELNO'),
  };

  return hasGuideContent(guide) ? guide : undefined;
}

async function fetchAllPages(
  sigunguName: string,
  endpoint: string,
  signal: AbortSignal | undefined,
  request: FetchRequester,
  policy: RegionalGuideRecoveryPolicy,
): Promise<PageCollectionResult> {
  const items: unknown[] = [];
  const startedAt = Date.now();
  let fetchedPageCount = 0;

  const fetchPageWithinBudget = async (pageNo: number) => {
    const remainingBudgetMs = policy.totalTimeoutMs - (Date.now() - startedAt);
    if (remainingBudgetMs <= 0) throw new RegionalGuideTimeoutError();

    const page = await fetchPageWithTimeout(
      sigunguName,
      endpoint,
      pageNo,
      signal,
      request,
      Math.min(policy.pageTimeoutMs, remainingBudgetMs),
    );
    fetchedPageCount += 1;
    return page;
  };

  const firstPage = await fetchPageWithinBudget(1);
  items.push(...firstPage.items);
  const totalCount = firstPage.totalCount;

  if (totalCount === undefined) return { items };
  if (items.length > totalCount) {
    return partialPageResult(
      items,
      'inconsistent-response',
      fetchedPageCount,
      totalCount,
    );
  }
  if (items.length === totalCount) return { items };

  const pageSize = normalizedPageSize(firstPage.numOfRows);
  const totalPageCount = pageSize
    ? Math.ceil(totalCount / pageSize)
    : fetchedPageCount;
  const lastPageNo = Math.min(
    Math.max(totalPageCount, fetchedPageCount),
    policy.maxPageCount,
  );

  for (let pageNo = 2; pageNo <= lastPageNo; pageNo += 1) {
    let page: ApiPage;
    try {
      page = await fetchPageWithinBudget(pageNo);
    } catch (error) {
      if (signal?.aborted) throw abortReason(signal);
      if (isAbortError(error)) throw error;
      return partialPageResult(
        items,
        classifyPartialFailure(error),
        fetchedPageCount,
        totalCount,
        pageNo,
      );
    }

    if (page.totalCount !== undefined && page.totalCount !== totalCount) {
      return partialPageResult(
        items,
        'inconsistent-response',
        fetchedPageCount,
        totalCount,
        pageNo,
      );
    }
    items.push(...page.items);
    if (items.length > totalCount) {
      return partialPageResult(
        items,
        'inconsistent-response',
        fetchedPageCount,
        totalCount,
        pageNo,
      );
    }
    if (items.length === totalCount) return { items };
    if (page.items.length === 0) {
      return partialPageResult(
        items,
        'inconsistent-response',
        fetchedPageCount,
        totalCount,
        pageNo,
      );
    }
  }

  if (totalPageCount > policy.maxPageCount) {
    return partialPageResult(
      items,
      'page-limit',
      fetchedPageCount,
      totalCount,
    );
  }
  if (items.length < totalCount) {
    return partialPageResult(
      items,
      'inconsistent-response',
      fetchedPageCount,
      totalCount,
    );
  }
  return { items };
}

async function fetchPageWithTimeout(
  sigunguName: string,
  endpoint: string,
  pageNo: number,
  externalSignal: AbortSignal | undefined,
  request: FetchRequester,
  timeoutMs: number,
): Promise<ApiPage> {
  throwIfAborted(externalSignal);

  const requestController = new AbortController();
  let externalAbortListener: (() => void) | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const externalAbort = new Promise<never>((_, reject) => {
    if (!externalSignal) return;
    externalAbortListener = () => {
      const error = abortReason(externalSignal);
      reject(error);
      requestController.abort(error);
    };
    externalSignal.addEventListener('abort', externalAbortListener, {
      once: true,
    });
  });
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new RegionalGuideTimeoutError();
      reject(error);
      requestController.abort(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fetchPage(
        sigunguName,
        endpoint,
        pageNo,
        requestController.signal,
        request,
      ),
      externalAbort,
      timeout,
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (externalSignal && externalAbortListener) {
      externalSignal.removeEventListener('abort', externalAbortListener);
    }
  }
}

async function fetchPage(
  sigunguName: string,
  endpoint: string,
  pageNo: number,
  signal: AbortSignal,
  request: FetchRequester,
): Promise<ApiPage> {
  const response = await request(
    createRequestUrl(endpoint, sigunguName, pageNo),
    { signal },
  );
  if (!response.ok) throw new RegionalGuideApiError();

  const payload: unknown = await response.json();
  const page = readApiPage(payload);
  if (!page) throw new RegionalGuideApiError();
  return page;
}

function createRequestUrl(
  endpoint: string,
  sigunguName: string,
  pageNo: number,
): string {
  const url = new URL(endpoint);
  url.searchParams.set('sigunguName', sigunguName);
  url.searchParams.set('pageNo', String(pageNo));
  url.searchParams.set('numOfRows', String(PAGE_SIZE));
  return url.toString();
}

function readApiPage(payload: unknown): ApiPage | undefined {
  const response = isRecord(payload) ? readRecord(payload.response) : undefined;
  const header = readRecord(response?.header);
  const body = readRecord(response?.body);
  if (!body || readResultCode(header) !== 0) return undefined;

  const item = readRecord(body.items)?.item;
  return {
    items: Array.isArray(item) ? item : isRecord(item) ? [item] : [],
    numOfRows: readNonNegativeInteger(body, 'numOfRows'),
    totalCount: readNonNegativeInteger(body, 'totalCount'),
  };
}

function createSchedule(
  wasteType: RegionalWasteType,
  item: Record<string, unknown>,
  prefix: string,
): RegionalWasteSchedule | undefined {
  const disposalDays = normalizeDays(readText(item, `${prefix}_EMSN_DOW`));
  const disposalStartTime = normalizeTime(
    readText(item, `${prefix}_EMSN_BGNG_TM`),
  );
  const disposalEndTime = normalizeTime(
    readText(item, `${prefix}_EMSN_END_TM`),
  );
  const disposalMethod = readText(item, `${prefix}_EMSN_MTHD`);

  if (
    !disposalDays &&
    !disposalStartTime &&
    !disposalEndTime &&
    !disposalMethod
  ) {
    return undefined;
  }
  return {
    wasteType,
    disposalDays,
    disposalStartTime,
    disposalEndTime,
    disposalMethod,
  };
}

function partialPageResult(
  items: unknown[],
  reason: RegionalGuidePartialResultReason,
  fetchedPageCount: number,
  totalCount: number,
  failedPageNo?: number,
): PageCollectionResult {
  return {
    items,
    partialMetadata: {
      reason,
      fetchedPageCount,
      receivedItemCount: items.length,
      totalCount,
      ...(failedPageNo === undefined ? {} : { failedPageNo }),
    },
  };
}

function distinctGuides(
  guides: readonly RegionalDisposalGuide[],
): readonly RegionalDisposalGuide[] {
  return [
    ...new Map(guides.map(guide => [JSON.stringify(guide), guide])).values(),
  ];
}

function normalizeDays(value: string | undefined): string | undefined {
  return (
    value
      ?.replace(/요일/g, '')
      .split(/[,+/|]/)
      .map(day => day.trim())
      .filter(Boolean)
      .filter((day, index, days) => days.indexOf(day) === index)
      .join(', ') || undefined
  );
}

function normalizeTime(value: string | undefined): string | undefined {
  if (!value || ['0000', '00:00', '00:00:00'].includes(value)) {
    return undefined;
  }
  const compactTime = /^(\d{2})(\d{2})$/.exec(value);
  if (!compactTime) return value;

  const hour = Number(compactTime[1]);
  const minute = Number(compactTime[2]);
  return (hour < 24 || (hour === 24 && minute === 0)) && minute < 60
    ? `${compactTime[1]}:${compactTime[2]}`
    : value;
}

function hasGuideContent(guide: RegionalDisposalGuide): boolean {
  return Boolean(
    guide.sidoName ||
      guide.sigunguName ||
      guide.managementZoneName ||
      guide.targetRegionName ||
      guide.disposalPlaceType ||
      guide.disposalPlace ||
      guide.uncollectedDays ||
      guide.schedules.length > 0,
  );
}

function classifyFailure(error: unknown): RegionalGuideFailureReason {
  if (error instanceof RegionalGuideTimeoutError) return 'timeout';
  if (error instanceof RegionalGuideApiError || error instanceof SyntaxError) {
    return 'api';
  }
  if (error instanceof TypeError) return 'network';
  return 'unknown';
}

function classifyPartialFailure(
  error: unknown,
): RegionalGuidePartialResultReason {
  const reason = classifyFailure(error);
  return reason === 'configuration' ? 'unknown' : reason;
}

function normalizeRecoveryPolicy(
  policy: RegionalGuideRecoveryPolicy,
): RegionalGuideRecoveryPolicy {
  return {
    pageTimeoutMs: positiveInteger(policy.pageTimeoutMs),
    totalTimeoutMs: positiveInteger(policy.totalTimeoutMs),
    maxPageCount: positiveInteger(policy.maxPageCount),
  };
}

function normalizedPageSize(value: number | undefined): number | undefined {
  if (value === undefined) return PAGE_SIZE;
  if (value <= 0) return undefined;
  return Math.min(value, PAGE_SIZE);
}

function positiveInteger(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function normalizeEndpoint(value: string | undefined): string | undefined {
  const endpoint = normalizeText(value);
  if (!endpoint) return undefined;
  try {
    const url = new URL(endpoint);
    if (
      [...url.searchParams.keys()].some(
        key => key.toLowerCase() === 'servicekey',
      )
    ) {
      return undefined;
    }
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function readText(
  record: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  return record ? normalizeText(record[key]) : undefined;
}

function readResultCode(
  header: Record<string, unknown> | undefined,
): number | undefined {
  const value = header?.resultCode;
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : undefined;
  }
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const resultCode = Number(value);
  return Number.isInteger(resultCode) ? resultCode : undefined;
}

function readNonNegativeInteger(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = record[key];
  if (typeof value === 'string' && !value.trim()) return undefined;
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0
    ? numericValue
    : undefined;
}

function normalizeText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortReason(signal);
}

function abortReason(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason;
  const error = new Error('요청이 취소되었습니다.');
  error.name = 'AbortError';
  return error;
}

class RegionalGuideApiError extends Error {}
class RegionalGuideTimeoutError extends Error {}

type ApiPage = Readonly<{
  items: unknown[];
  numOfRows?: number;
  totalCount?: number;
}>;

type PageCollectionResult = Readonly<{
  items: unknown[];
  partialMetadata?: Omit<
    RegionalGuidePartialResultMetadata,
    'duplicateGuideCount'
  >;
}>;

type CompleteRegionalGuideLookupResult = Extract<
  RegionalGuideLookupResult,
  { status: 'success' | 'not-found' }
>;
