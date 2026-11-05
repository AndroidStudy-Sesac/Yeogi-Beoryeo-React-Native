import type {
  RegionalDisposalGuide,
  RegionalWasteSchedule,
} from './RegionalDisposalGuide';

export type HomeRegionalGuideSummary = Readonly<{
  regionName: string;
  disposalDays?: string;
  disposalTime?: string;
  hasDifferentDisposalDays: boolean;
  hasDifferentDisposalTime: boolean;
}>;

const NEEDS_CONFIRMATION_DAY_LABELS = new Set(['기타', '미지정', '해당없음']);

export function buildHomeRegionalGuideSummary(
  guide: RegionalDisposalGuide,
  fallbackRegionName: string,
): HomeRegionalGuideSummary {
  const representativeSchedule = guide.schedules.find(
    schedule => schedule.wasteType === 'general',
  );
  const regionName = [guide.sidoName, guide.sigunguName, guide.targetRegionName]
    .map(normalize)
    .filter((value): value is string => value !== undefined)
    .join(' > ');

  return {
    regionName: regionName || fallbackRegionName,
    disposalDays: representativeDays(representativeSchedule?.disposalDays),
    disposalTime: displayTime(representativeSchedule),
    hasDifferentDisposalDays: hasDifferentValues(
      guide.schedules,
      schedule => normalize(schedule.disposalDays),
    ),
    hasDifferentDisposalTime: hasDifferentValues(
      guide.schedules,
      displayTime,
    ),
  };
}

function representativeDays(value: string | undefined): string | undefined {
  const days = normalize(value);
  if (!days) return undefined;
  return days
    .split(',')
    .map(day => day.trim())
    .some(day => NEEDS_CONFIRMATION_DAY_LABELS.has(day))
    ? undefined
    : days;
}

function displayTime(
  schedule: RegionalWasteSchedule | undefined,
): string | undefined {
  const start = normalize(schedule?.disposalStartTime);
  const end = normalize(schedule?.disposalEndTime);
  if (start && end) return `${start} ~ ${end}`;
  if (start) return `${start} 이후`;
  if (end) return `${end} 이전`;
  return undefined;
}

function hasDifferentValues(
  schedules: readonly RegionalWasteSchedule[],
  select: (schedule: RegionalWasteSchedule) => string | undefined,
): boolean {
  return new Set(schedules.map(select).filter(Boolean)).size > 1;
}

function normalize(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}
