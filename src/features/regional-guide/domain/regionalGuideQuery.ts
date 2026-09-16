import type { RegionSelection } from './Region';

export type RegionalGuideQuery = Readonly<{
  sidoName?: string;
  sigunguName: string;
  eupmyeondongName?: string;
  eupmyeondongAliases?: readonly string[];
}>;

export function createRegionalGuideQuery(
  selection: RegionSelection,
  eupmyeondongAliases: readonly string[] = [],
): RegionalGuideQuery | undefined {
  const sidoName = normalizeText(selection.sido?.name);
  const sigunguName = normalizeText(selection.sigungu?.name);
  if (!sigunguName) return undefined;

  const eupmyeondongName = normalizeText(selection.eupmyeondong?.name);
  const aliases = [...new Set(eupmyeondongAliases.map(normalizeText).filter(
    (value): value is string => Boolean(value) && value !== eupmyeondongName,
  ))];
  return {
    ...(sidoName ? { sidoName } : {}),
    sigunguName,
    ...(eupmyeondongName ? { eupmyeondongName } : {}),
    ...(aliases.length > 0 ? { eupmyeondongAliases: aliases } : {}),
  };
}

function normalizeText(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}
