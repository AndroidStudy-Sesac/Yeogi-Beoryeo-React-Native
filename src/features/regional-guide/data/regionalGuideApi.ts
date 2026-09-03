import type {
  RegionalDisposalGuide,
  RegionalGuideFailureReason,
  RegionalGuideLookupResult,
  RegionalGuidePartialResultMetadata,
  RegionalGuidePartialResultReason,
  RegionalWasteSchedule,
  RegionalWasteType,
} from "../domain/RegionalDisposalGuide";

const HOUSEHOLD_WASTE_INFO_URL =
  "https://apis.data.go.kr/1741000/household_waste_info/info";
const PAGE_SIZE = 100;

export interface RegionalGuideRecoveryPolicy {
  pageTimeoutMs: number;
  totalTimeoutMs: number;
  maxPageCount: number;
}

export const DEFAULT_REGIONAL_GUIDE_RECOVERY_POLICY: RegionalGuideRecoveryPolicy =
  {
    pageTimeoutMs: 2_000,
    totalTimeoutMs: 5_000,
    maxPageCount: 5,
  };

export interface RegionalGuideApiConfig {
  serviceKey?: string;
}

interface FetchOptions {
  signal?: AbortSignal;
}

type FetchRequester = (input: string, init?: FetchOptions) => Promise<Response>;

export interface RegionalGuideApiClient {
  fetchRegionalDisposalGuides(
    sigunguName: string,
    signal?: AbortSignal,
  ): Promise<RegionalGuideLookupResult>;
  clearCache?(sigunguName?: string): void;
}

/**
 * Expo가 앱 번들 시점에 주입하는 공개 환경 변수를 읽습니다.
 * 이 값은 비밀 저장소가 아니므로 정식 개발에서는 BFF가 API 키를 보관해야 합니다.
 */
export function getRegionalGuideApiConfig(): RegionalGuideApiConfig {
  return {
    serviceKey: process.env.EXPO_PUBLIC_HOUSEHOLD_WASTE_SERVICE_KEY,
  };
}

export function createRegionalGuideApiConfig(
  environment: Record<string, string | undefined>,
): RegionalGuideApiConfig {
  return { serviceKey: environment.EXPO_PUBLIC_HOUSEHOLD_WASTE_SERVICE_KEY };
}

export function createRegionalGuideApiClient(
  config: RegionalGuideApiConfig = getRegionalGuideApiConfig(),
  request: FetchRequester = fetch,
  recoveryPolicy: RegionalGuideRecoveryPolicy = DEFAULT_REGIONAL_GUIDE_RECOVERY_POLICY,
): RegionalGuideApiClient {
  let recentCompleteResult:
    | { sigunguName: string; result: CompleteRegionalGuideLookupResult }
    | undefined;

  return {
    fetchRegionalDisposalGuides: async (sigunguName, signal) => {
      throwIfAborted(signal);

      const cacheKey = normalizeText(sigunguName) ?? "";
      if (recentCompleteResult?.sigunguName === cacheKey) {
        return recentCompleteResult.result;
      }

      const result = await fetchRegionalDisposalGuides(
        sigunguName,
        config,
        signal,
        request,
        recoveryPolicy,
      );
      if (result.status === "success" || result.status === "not-found") {
        recentCompleteResult = { sigunguName: cacheKey, result };
      }
      return result;
    },
    clearCache(sigunguName) {
      if (
        !sigunguName ||
        recentCompleteResult?.sigunguName === normalizeText(sigunguName)
      ) {
        recentCompleteResult = undefined;
      }
    },
  };
}

export async function fetchRegionalDisposalGuides(
  sigunguName: string,
  config: RegionalGuideApiConfig,
  signal?: AbortSignal,
  request: FetchRequester = fetch,
  recoveryPolicy: RegionalGuideRecoveryPolicy = DEFAULT_REGIONAL_GUIDE_RECOVERY_POLICY,
): Promise<RegionalGuideLookupResult> {
  throwIfAborted(signal);

  const normalizedSigunguName = normalizeText(sigunguName);
  const serviceKey = normalizeText(config.serviceKey);
  if (!normalizedSigunguName || !serviceKey) {
    return { status: "failure", reason: "configuration" };
  }

  try {
    const pageResult = await fetchAllPages(
      normalizedSigunguName,
      serviceKey,
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
        status: "partial",
        guides,
        metadata: {
          ...pageResult.partialMetadata,
          duplicateGuideCount: mappedGuides.length - guides.length,
        },
      };
    }

    return guides.length > 0
      ? { status: "success", guides }
      : { status: "not-found" };
  } catch (error) {
    if (signal?.aborted) throw abortReason(signal);
    if (isAbortError(error)) throw error;
    return { status: "failure", reason: classifyFailure(error) };
  }
}

export function mapRegionalGuideItem(
  item: unknown,
): RegionalDisposalGuide | undefined {
  if (!isRecord(item)) return undefined;

  const guide: RegionalDisposalGuide = {
    sidoName: readText(item, "CTPV_NM"),
    sigunguName: readText(item, "SGG_NM"),
    managementZoneName: readText(item, "MNG_ZONE_NM"),
    targetRegionName: readText(item, "MNG_ZONE_TRGT_RGN_NM"),
    disposalPlaceType: readText(item, "EMSN_PLC_TYPE"),
    disposalPlace: readText(item, "EMSN_PLC"),
    uncollectedDays: normalizeDays(readText(item, "UNCLLT_DAY")),
    schedules: [
      createSchedule("general", item, "LF_WST"),
      createSchedule("food", item, "FOD_WST"),
      createSchedule("recyclable", item, "RCYCL"),
    ].filter(
      (schedule): schedule is RegionalWasteSchedule => schedule !== undefined,
    ),
    departmentName: readText(item, "MNG_DEPT_NM"),
    departmentPhoneNumber: readText(item, "MNG_DEPT_TELNO"),
  };

  return hasGuideContent(guide) ? guide : undefined;
}

async function fetchAllPages(
  sigunguName: string,
  serviceKey: string,
  signal: AbortSignal | undefined,
  request: FetchRequester,
  recoveryPolicy: RegionalGuideRecoveryPolicy,
): Promise<PageCollectionResult> {
  const allItems: unknown[] = [];
  const startedAt = Date.now();
  let fetchedPageCount = 0;

  const fetchPageWithinBudget = async (pageNo: number) => {
    const remainingBudgetMs =
      recoveryPolicy.totalTimeoutMs - (Date.now() - startedAt);
    if (remainingBudgetMs <= 0) throw new RegionalGuideTimeoutError();

    const page = await fetchPageWithTimeout(
      sigunguName,
      serviceKey,
      pageNo,
      signal,
      request,
      Math.min(recoveryPolicy.pageTimeoutMs, remainingBudgetMs),
    );
    fetchedPageCount += 1;
    return page;
  };

  const firstPage = await fetchPageWithinBudget(1);
  allItems.push(...firstPage.items);
  const totalCount = firstPage.totalCount;

  if (totalCount === undefined) return { items: allItems };
  if (allItems.length > totalCount) {
    return partialPageResult(
      allItems,
      "inconsistent-response",
      fetchedPageCount,
      totalCount,
    );
  }
  if (allItems.length === totalCount) return { items: allItems };

  const pageSize = normalizedPageSize(firstPage.numOfRows);
  const totalPageCount = pageSize
    ? Math.ceil(totalCount / pageSize)
    : fetchedPageCount;
  const lastPageNo = Math.min(
    Math.max(totalPageCount, fetchedPageCount),
    recoveryPolicy.maxPageCount,
  );

  for (let pageNo = 2; pageNo <= lastPageNo; pageNo += 1) {
    let page: ApiPage;
    try {
      page = await fetchPageWithinBudget(pageNo);
    } catch (error) {
      if (signal?.aborted) throw abortReason(signal);
      if (isAbortError(error)) throw error;

      return partialPageResult(
        allItems,
        classifyPartialFailure(error),
        fetchedPageCount,
        totalCount,
        pageNo,
      );
    }

    allItems.push(...page.items);

    if (allItems.length > totalCount) {
      return partialPageResult(
        allItems,
        "inconsistent-response",
        fetchedPageCount,
        totalCount,
        pageNo,
      );
    }
    if (allItems.length === totalCount) return { items: allItems };
    if (page.items.length === 0) {
      return partialPageResult(
        allItems,
        "inconsistent-response",
        fetchedPageCount,
        totalCount,
        pageNo,
      );
    }
  }

  if (totalPageCount > recoveryPolicy.maxPageCount) {
    return partialPageResult(
      allItems,
      "page-limit",
      fetchedPageCount,
      totalCount,
    );
  }
  if (allItems.length < totalCount) {
    return partialPageResult(
      allItems,
      "inconsistent-response",
      fetchedPageCount,
      totalCount,
    );
  }

  return { items: allItems };
}

async function fetchPageWithTimeout(
  sigunguName: string,
  serviceKey: string,
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
    externalSignal.addEventListener("abort", externalAbortListener, {
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
        serviceKey,
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
      externalSignal.removeEventListener("abort", externalAbortListener);
    }
  }
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

function normalizedPageSize(numOfRows: number | undefined): number | undefined {
  if (numOfRows === undefined) return PAGE_SIZE;
  if (numOfRows <= 0) return undefined;
  return Math.min(numOfRows, PAGE_SIZE);
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

function positiveInteger(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function distinctGuides(
  guides: RegionalDisposalGuide[],
): RegionalDisposalGuide[] {
  return [
    ...new Map(guides.map((guide) => [JSON.stringify(guide), guide])).values(),
  ];
}

async function fetchPage(
  sigunguName: string,
  serviceKey: string,
  pageNo: number,
  signal: AbortSignal | undefined,
  request: FetchRequester,
): Promise<ApiPage> {
  const response = await request(
    createRequestUrl(sigunguName, serviceKey, pageNo),
    { signal },
  );
  if (!response.ok)
    throw new RegionalGuideApiError("HTTP 요청에 실패했습니다.");

  const payload: unknown = await response.json();
  const page = readApiPage(payload);
  if (!page)
    throw new RegionalGuideApiError("API 응답 형식이 올바르지 않습니다.");
  return page;
}

function createRequestUrl(
  sigunguName: string,
  serviceKey: string,
  pageNo: number,
): string {
  const params = new URLSearchParams({
    serviceKey,
    pageNo: String(pageNo),
    numOfRows: String(PAGE_SIZE),
    returnType: "json",
    "cond[SGG_NM::LIKE]": sigunguName,
  });
  return `${HOUSEHOLD_WASTE_INFO_URL}?${params.toString()}`;
}

function readApiPage(payload: unknown): ApiPage | undefined {
  const response = isRecord(payload) ? readRecord(payload.response) : undefined;
  const header = readRecord(response?.header);
  const body = readRecord(response?.body);
  const resultCode = readResultCode(header);
  if (!body || resultCode !== 0) return undefined;

  const items = readRecord(body?.items)?.item;
  return {
    items: Array.isArray(items) ? items : isRecord(items) ? [items] : [],
    numOfRows: readNonNegativeInteger(body, "numOfRows"),
    totalCount: readNonNegativeInteger(body, "totalCount"),
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

function normalizeDays(value: string | undefined): string | undefined {
  return (
    value
      ?.replace(/요일/g, "")
      .split(/[,+/|]/)
      .map((day) => day.trim())
      .filter(Boolean)
      .filter((day, index, days) => days.indexOf(day) === index)
      .join(", ") || undefined
  );
}

function normalizeTime(value: string | undefined): string | undefined {
  if (!value || value === "0000" || value === "00:00" || value === "00:00:00") {
    return undefined;
  }

  const compactTime = /^(\d{2})(\d{2})$/.exec(value);
  if (!compactTime) return value;

  const [, hourText, minuteText] = compactTime;
  const hour = Number(hourText);
  const minute = Number(minuteText);
  return (hour < 24 || (hour === 24 && minute === 0)) && minute < 60
    ? `${hourText}:${minuteText}`
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
  if (error instanceof RegionalGuideTimeoutError) return "timeout";
  if (error instanceof RegionalGuideApiError) return "api";
  if (error instanceof TypeError) return "network";
  if (error instanceof SyntaxError) return "api";
  return "unknown";
}

function classifyPartialFailure(
  error: unknown,
): RegionalGuidePartialResultReason {
  const reason = classifyFailure(error);
  return reason === "configuration" ? "unknown" : reason;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortReason(signal);
}

function abortReason(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason;

  const error = new Error("요청이 취소되었습니다.");
  error.name = "AbortError";
  return error;
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
  if (typeof value === "number")
    return Number.isInteger(value) ? value : undefined;
  if (typeof value !== "string" || !value.trim()) return undefined;

  const resultCode = Number(value);
  return Number.isInteger(resultCode) ? resultCode : undefined;
}

function readNonNegativeInteger(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = record[key];
  if (typeof value === "string" && !value.trim()) return undefined;
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isInteger(numberValue) && numberValue >= 0
    ? numberValue
    : undefined;
}

function normalizeText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

class RegionalGuideApiError extends Error {}

class RegionalGuideTimeoutError extends Error {}

interface ApiPage {
  items: unknown[];
  numOfRows?: number;
  totalCount?: number;
}

interface PageCollectionResult {
  items: unknown[];
  partialMetadata?: Omit<
    RegionalGuidePartialResultMetadata,
    "duplicateGuideCount"
  >;
}

type CompleteRegionalGuideLookupResult = Extract<
  RegionalGuideLookupResult,
  { status: "success" | "not-found" }
>;
