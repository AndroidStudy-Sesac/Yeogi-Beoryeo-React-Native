import type { RegionSelection } from '../domain/Region';
import type {
  RegionalDisposalGuide,
  RegionalWasteSchedule,
  RegionalWasteType,
} from '../domain/RegionalDisposalGuide';
import type { RegionalGuideCandidateReason } from '../domain/selectRegionalGuideCandidate';

export type RegionalGuideCandidateDisplayMode = 'collection-type' | 'list';

export type RegionalGuideCandidatePresentation = Readonly<{
  guide: RegionalDisposalGuide;
  key: string;
  label: string;
  collectionTypeLabel: string;
  collectionTypeSupportingText?: string;
  distinguishingText?: string;
}>;

export function regionalGuideCandidateDisplayMode(
  guides: readonly RegionalDisposalGuide[],
  reason: RegionalGuideCandidateReason,
): RegionalGuideCandidateDisplayMode {
  if (reason === 'multiple-exact-matches') return 'list';

  const hasOnlyCollectionTypeCandidates =
    guides.length > 1 &&
    guides.every(isCollectionTypeSelectionCandidate) &&
    new Set(guides.map(guide => displayValue(guide.disposalPlaceType))).size > 1;
  if (!hasOnlyCollectionTypeCandidates) return 'list';

  if (reason === 'fallback-because-direct-match-not-found') {
    return 'collection-type';
  }
  return guides.every(isOverallCollectionTypeCandidate)
    ? 'collection-type'
    : 'list';
}

export function presentRegionalGuideCandidates(
  guides: readonly RegionalDisposalGuide[],
  selection: RegionSelection,
): readonly RegionalGuideCandidatePresentation[] {
  const candidates = guides.map((guide, index) => ({
    guide,
    index,
    baseLabel: candidateBaseLabel(guide, selection),
  }));
  const disambiguationByIndex = duplicateDisambiguations(candidates);

  return candidates
    .map(({ guide, index, baseLabel }) => {
      const disambiguation = disambiguationByIndex.get(index);
      const label = appendDistinctLabel(baseLabel, disambiguation);
      const collectionTypeLabel = isOverallCollectionTypeCandidate(guide)
        ? displayValue(guide.disposalPlaceType) ?? label
        : label;

      return {
        guide,
        key: candidateKey(guide, index),
        label,
        collectionTypeLabel,
        collectionTypeSupportingText: collectionTypeSupportingText(guide),
        distinguishingText: candidateDistinguishingText(guide),
      };
    })
    .sort((left, right) => compareCandidateLabels(left.label, right.label));
}

function duplicateDisambiguations(
  candidates: readonly {
    guide: RegionalDisposalGuide;
    index: number;
    baseLabel: string;
  }[],
): ReadonlyMap<number, string | undefined> {
  const result = new Map<number, string | undefined>();
  const groups = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    groups.set(candidate.baseLabel, [
      ...(groups.get(candidate.baseLabel) ?? []),
      candidate,
    ]);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const choices = group.map(candidate => duplicateChoices(candidate.guide));
    const choiceIndex = Array.from({ length: 5 }, (_, index) => index).find(
      index => new Set(choices.map(values => values[index])).size > 1,
    );
    if (choiceIndex === undefined) continue;

    group.forEach((candidate, index) => {
      result.set(candidate.index, choices[index][choiceIndex]);
    });
  }
  return result;
}

function duplicateChoices(
  guide: RegionalDisposalGuide,
): readonly (string | undefined)[] {
  return [
    displayValue(guide.disposalPlaceType),
    displayValue(guide.disposalPlace),
    guide.schedules.map(schedule => scheduleSummary(schedule, true)).find(Boolean),
    displayValue(guide.uncollectedDays),
    departmentInfo(guide),
  ];
}

function candidateBaseLabel(
  guide: RegionalDisposalGuide,
  selection: RegionSelection,
): string {
  const primaryParts = distinctValues([
    displayValue(guide.managementZoneName),
    displayValue(guide.targetRegionName),
  ]);
  if (primaryParts.length > 0) return primaryParts.join(' / ');

  const regionParts = distinctValues([
    displayValue(guide.sidoName ?? selection.sido?.name),
    displayValue(guide.sigunguName ?? selection.sigungu?.name),
    displayValue(selection.eupmyeondong?.name),
  ]);
  const regionLabel = regionParts.join(' ') || '지역 정보';
  const fallback =
    displayValue(guide.disposalPlaceType) ??
    displayValue(guide.disposalPlace) ??
    guide.schedules.map(schedule => scheduleSummary(schedule, false)).find(Boolean);
  return appendDistinctLabel(regionLabel, fallback);
}

function candidateDistinguishingText(
  guide: RegionalDisposalGuide,
): string | undefined {
  const disposalPlace = displayValue(guide.disposalPlace);
  if (disposalPlace) return `배출장소: ${disposalPlace}`;

  const uncollectedDays = displayValue(guide.uncollectedDays);
  if (uncollectedDays) return `미수거일: ${uncollectedDays}`;

  const schedule = guide.schedules
    .map(value => scheduleSummary(value, false))
    .find(Boolean);
  if (schedule) return `배출 기준: ${schedule}`;

  const department = departmentInfo(guide);
  return department ? `담당부서: ${department}` : undefined;
}

function isCollectionTypeSelectionCandidate(
  guide: RegionalDisposalGuide,
): boolean {
  if (isOverallCollectionTypeCandidate(guide)) return true;

  const disposalPlaceType = displayValue(guide.disposalPlaceType);
  if (!disposalPlaceType || !collectionTypeHint(disposalPlaceType)) return false;
  const displayParts = distinctValues([
    displayValue(guide.managementZoneName),
    displayValue(guide.targetRegionName),
  ]);
  return (
    displayParts.length > 0 &&
    displayParts.every(value => isCollectionTypeDisplayName(value, disposalPlaceType))
  );
}

function isOverallCollectionTypeCandidate(guide: RegionalDisposalGuide): boolean {
  return (
    !displayValue(guide.managementZoneName) &&
    !displayValue(guide.targetRegionName) &&
    Boolean(displayValue(guide.disposalPlaceType))
  );
}

function collectionTypeSupportingText(
  guide: RegionalDisposalGuide,
): string | undefined {
  const hint = collectionTypeHint(displayValue(guide.disposalPlaceType));
  if (hint === 'door-to-door') {
    return '집 앞 또는 지정된 배출장소에 배출하는 지역';
  }
  if (hint === 'base-point') {
    return '마을 거점 또는 지정 수거 장소를 이용하는 지역';
  }
  return undefined;
}

function collectionTypeHint(
  value: string | undefined,
): 'door-to-door' | 'base-point' | undefined {
  if (value === '문전수거') return 'door-to-door';
  if (value === '거점수거') return 'base-point';
  return undefined;
}

function isCollectionTypeDisplayName(value: string, type: string): boolean {
  const normalizedValue = value.replace(/\s+/g, '');
  const normalizedType = type.replace(/\s+/g, '');
  return (
    normalizedValue === normalizedType ||
    normalizedValue === `${normalizedType}지역`
  );
}

function scheduleSummary(
  schedule: RegionalWasteSchedule,
  preferTime: boolean,
): string | undefined {
  const time = formatScheduleTime(schedule);
  const criterion =
    (preferTime ? time : undefined) ??
    displayValue(schedule.disposalDays) ??
    time ??
    displayValue(schedule.disposalMethod) ??
    displayValue(schedule.disposalPlace);
  return criterion ? `${wasteTypeLabel(schedule.wasteType)} ${criterion}` : undefined;
}

function formatScheduleTime(
  schedule: RegionalWasteSchedule,
): string | undefined {
  const start = displayValue(schedule.disposalStartTime);
  const end = displayValue(schedule.disposalEndTime);
  if (start && end) return `${start} ~ ${end}`;
  if (start) return `${start} 이후`;
  if (end) return `${end} 이전`;
  return undefined;
}

function wasteTypeLabel(wasteType: RegionalWasteType): string {
  if (wasteType === 'general') return '일반쓰레기';
  if (wasteType === 'food') return '음식물쓰레기';
  return '재활용품';
}

function departmentInfo(guide: RegionalDisposalGuide): string | undefined {
  const value = distinctValues([
    displayValue(guide.departmentName),
    displayValue(guide.departmentPhoneNumber),
  ]).join(' ');
  return value || undefined;
}

function appendDistinctLabel(
  label: string,
  detail: string | undefined,
): string {
  return detail && !label.split(' / ').includes(detail)
    ? `${label} / ${detail}`
    : label;
}

function distinctValues(
  values: readonly (string | undefined)[],
): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function displayValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized || ['-', '없음', '해당없음'].includes(normalized)) {
    return undefined;
  }
  return normalized;
}

function candidateKey(guide: RegionalDisposalGuide, index: number): string {
  const parts = [
    guide.sidoName,
    guide.sigunguName,
    guide.managementZoneName,
    guide.targetRegionName,
    guide.disposalPlaceType,
    guide.disposalPlace,
    guide.uncollectedDays,
    departmentInfo(guide),
    ...guide.schedules.flatMap(schedule => [
      schedule.wasteType,
      schedule.disposalDays,
      schedule.disposalStartTime,
      schedule.disposalEndTime,
      schedule.disposalMethod,
      schedule.disposalPlace,
    ]),
  ];
  return `${parts.map(part => `${part?.length ?? 0}:${part ?? ''}`).join('|')}#${index}`;
}

const naturalCollator = new Intl.Collator('ko', {
  numeric: true,
  sensitivity: 'base',
});

function compareCandidateLabels(left: string, right: string): number {
  return naturalCollator.compare(orderedRegionLabel(left), orderedRegionLabel(right));
}

function orderedRegionLabel(value: string): string {
  const firstPart = value.split(' / ')[0].trim();
  const numeric = /^제?\s*(\d+)/.exec(firstPart)?.[1];
  const roman = /^([IVXLCDM]+|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ]+)(?=\s*(?:구역|권역))/i.exec(
    firstPart,
  )?.[1];
  const order = numeric ? Number(numeric) : romanToNumber(roman);
  return order ? `${String(order).padStart(8, '0')} ${value}` : value;
}

function romanToNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const unicodeValues: Readonly<Record<string, number>> = {
    'Ⅰ': 1,
    'Ⅱ': 2,
    'Ⅲ': 3,
    'Ⅳ': 4,
    'Ⅴ': 5,
    'Ⅵ': 6,
    'Ⅶ': 7,
    'Ⅷ': 8,
    'Ⅸ': 9,
    'Ⅹ': 10,
    'Ⅺ': 11,
    'Ⅻ': 12,
  };
  if (unicodeValues[value]) return unicodeValues[value];

  const romanValues: Readonly<Record<string, number>> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };
  let total = 0;
  let previous = 0;
  for (const character of [...value.toUpperCase()].reverse()) {
    const current = romanValues[character];
    if (!current) return undefined;
    if (current < previous) total -= current;
    else {
      total += current;
      previous = current;
    }
  }
  return total || undefined;
}
