export type RegionalWasteType = "general" | "food" | "recyclable";

export interface RegionalWasteSchedule {
  wasteType: RegionalWasteType;
  disposalDays?: string;
  disposalStartTime?: string;
  disposalEndTime?: string;
  disposalPlace?: string;
  disposalMethod?: string;
}

export interface RegionalDisposalGuide {
  sidoName?: string;
  sigunguName?: string;
  managementZoneName?: string;
  targetRegionName?: string;
  disposalPlaceType?: string;
  disposalPlace?: string;
  uncollectedDays?: string;
  schedules: RegionalWasteSchedule[];
  departmentName?: string;
  departmentPhoneNumber?: string;
}

export type RegionalGuideFailureReason =
  | "configuration"
  | "network"
  | "api"
  | "unknown";

export type RegionalGuideLookupResult =
  | { status: "success"; guides: RegionalDisposalGuide[] }
  | { status: "not-found" }
  | { status: "failure"; reason: RegionalGuideFailureReason };
