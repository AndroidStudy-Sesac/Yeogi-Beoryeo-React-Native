import type {
  RegionalDisposalGuide,
  RegionalWasteType,
} from "./RegionalDisposalGuide";

export interface HomeRegionalGuideScheduleSummary {
  wasteType: RegionalWasteType;
  disposalDays?: string;
  disposalTime?: string;
}

export interface HomeRegionalGuideSummary {
  regionName: string;
  disposalPlace?: string;
  schedules: HomeRegionalGuideScheduleSummary[];
}

export function toHomeRegionalGuideSummary(
  guide: RegionalDisposalGuide,
  fallbackRegionName: string,
): HomeRegionalGuideSummary {
  const regionName = [guide.sidoName, guide.sigunguName, guide.targetRegionName]
    .filter(Boolean)
    .join(" > ");

  return {
    regionName: regionName || fallbackRegionName,
    disposalPlace: guide.disposalPlace,
    schedules: guide.schedules.map((schedule) => ({
      wasteType: schedule.wasteType,
      disposalDays: schedule.disposalDays,
      disposalTime: toDisposalTime(
        schedule.disposalStartTime,
        schedule.disposalEndTime,
      ),
    })),
  };
}

function toDisposalTime(
  startTime: string | undefined,
  endTime: string | undefined,
): string | undefined {
  if (startTime && endTime) return `${startTime}~${endTime}`;
  return startTime ?? endTime;
}
