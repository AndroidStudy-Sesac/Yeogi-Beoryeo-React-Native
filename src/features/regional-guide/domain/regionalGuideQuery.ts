import type { RegionSelection } from './Region';
import type { RegionalDisposalGuide } from './RegionalDisposalGuide';

export type RegionalGuideQuery = Readonly<{
  sigunguName: string;
  eupmyeondongName?: string;
}>;

export function createRegionalGuideQuery(
  selection: RegionSelection,
): RegionalGuideQuery | undefined {
  const sigunguName = normalizeText(selection.sigungu?.name);
  if (!sigunguName) return undefined;

  const eupmyeondongName = normalizeText(selection.eupmyeondong?.name);
  return {
    sigunguName,
    ...(eupmyeondongName ? { eupmyeondongName } : {}),
  };
}

export function selectGuidesForRegion(
  guides: readonly RegionalDisposalGuide[],
  eupmyeondongName?: string,
): readonly RegionalDisposalGuide[] {
  if (!eupmyeondongName) return guides;

  return guides.filter(guide =>
    [guide.targetRegionName, guide.managementZoneName].some(regionName =>
      regionNameMatches(regionName, eupmyeondongName),
    ),
  );
}

function regionNameMatches(
  providedRegionName: string | undefined,
  selectedRegionName: string,
): boolean {
  if (!providedRegionName) return false;

  const selectedName = normalizeRegionName(selectedRegionName);
  return providedRegionName.split(/[,+/]/).some(part => {
    const providedName = normalizeRegionName(part);
    const comparableProvidedName = removeOrdinal(providedName);
    const comparableSelectedName = removeOrdinal(selectedName);
    return (
      comparableProvidedName === comparableSelectedName ||
      ['전체', '전지역', '관내전지역'].includes(comparableProvidedName) ||
      comparableProvidedName.endsWith('전지역') ||
      comparableProvidedName.endsWith('전역') ||
      (comparableProvidedName === '동지역' && selectedName.endsWith('동')) ||
      (comparableProvidedName === '읍면지역' && /[읍면]$/.test(selectedName)) ||
      matchesNumberedRange(comparableProvidedName, comparableSelectedName)
    );
  });
}

function matchesNumberedRange(providedName: string, selectedName: string) {
  const range = /^(.+?)(\d+)동?~(\d+)동$/.exec(providedName);
  const numberedRegion = /^(.+?)(\d+)동$/.exec(selectedName);
  if (!range || !numberedRegion || range[1] !== numberedRegion[1]) return false;

  const first = Number(range[2]);
  const last = Number(range[3]);
  const selected = Number(numberedRegion[2]);
  return selected >= Math.min(first, last) && selected <= Math.max(first, last);
}

function removeOrdinal(value: string): string {
  return value.replace(/제(?=\d)/g, '');
}

function normalizeRegionName(value: string): string {
  return value.replace(/\s/g, '').trim();
}

function normalizeText(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}
