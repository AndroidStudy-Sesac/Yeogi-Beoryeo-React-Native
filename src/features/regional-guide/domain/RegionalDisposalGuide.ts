export type RegionalWasteType = 'general' | 'food' | 'recyclable';

export type RegionalWasteSchedule = Readonly<{
  wasteType: RegionalWasteType;
  disposalDays?: string;
  disposalStartTime?: string;
  disposalEndTime?: string;
  disposalMethod?: string;
  disposalPlace?: string;
}>;

export type RegionalGuideSourceMetadata = Readonly<{
  managementNumber?: string;
  lastModifiedPoint?: string;
  dataCriteriaDate?: string;
  dataUpdatedPoint?: string;
  dataUpdateType?: string;
}>;

export type RegionalDisposalGuide = Readonly<{
  sidoName?: string;
  sigunguName?: string;
  managementZoneName?: string;
  targetRegionName?: string;
  disposalPlaceType?: string;
  disposalPlace?: string;
  uncollectedDays?: string;
  schedules: readonly RegionalWasteSchedule[];
  departmentName?: string;
  departmentPhoneNumber?: string;
  sourceMetadata?: RegionalGuideSourceMetadata;
}>;

export type RegionalGuideFailureReason =
  | 'configuration'
  | 'timeout'
  | 'network'
  | 'api'
  | 'unknown';

export type RegionalGuidePartialResultReason =
  | 'page-limit'
  | 'timeout'
  | 'network'
  | 'api'
  | 'inconsistent-response'
  | 'unknown';

export type RegionalGuidePartialResultMetadata = Readonly<{
  reason: RegionalGuidePartialResultReason;
  fetchedPageCount: number;
  receivedItemCount: number;
  totalCount?: number;
  failedPageNo?: number;
  duplicateGuideCount: number;
}>;

export type RegionalGuideLookupResult =
  | Readonly<{ status: 'success'; guides: readonly RegionalDisposalGuide[] }>
  | Readonly<{
      status: 'partial';
      guides: readonly RegionalDisposalGuide[];
      metadata: RegionalGuidePartialResultMetadata;
    }>
  | Readonly<{ status: 'not-found' }>
  | Readonly<{ status: 'failure'; reason: RegionalGuideFailureReason }>;
