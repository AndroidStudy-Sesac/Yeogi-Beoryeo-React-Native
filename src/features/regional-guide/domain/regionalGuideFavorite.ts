import type { Region, RegionSelection } from './Region';
import type { RegionalDisposalGuide } from './RegionalDisposalGuide';

export const REGIONAL_GUIDE_FAVORITE_ID_PREFIX = 'regional-guide-v1';

export type RegionalGuideFavoriteIdentity = Readonly<{
  sidoName?: string;
  sigunguName?: string;
  targetRegionName?: string;
  managementZoneName?: string;
  disposalPlaceType?: string;
  managementNumber?: string;
}>;

export type RegionalGuideFavorite = Readonly<{
  targetId: string;
  selection: RegionSelection;
  identity: RegionalGuideFavoriteIdentity;
  savedAt: string;
}>;

export function createRegionalGuideFavorite(
  selection: RegionSelection,
  guide: RegionalDisposalGuide,
  savedAt = new Date().toISOString(),
): RegionalGuideFavorite {
  const identity = regionalGuideFavoriteIdentity(guide);
  return {
    targetId: createRegionalGuideFavoriteTargetId(selection, guide),
    selection,
    identity,
    savedAt,
  };
}

export function createRegionalGuideFavoriteTargetId(
  selection: RegionSelection,
  guide: RegionalDisposalGuide,
): string {
  const identity = regionalGuideFavoriteIdentity(guide);
  return [
    REGIONAL_GUIDE_FAVORITE_ID_PREFIX,
    encode(selection.sido?.id),
    encode(selection.sigungu?.id),
    encode(selection.eupmyeondong?.id),
    encode(identity.sidoName),
    encode(identity.sigunguName),
    encode(identity.targetRegionName),
    encode(identity.managementZoneName),
    encode(identity.disposalPlaceType),
    encode(identity.managementNumber),
  ].join('|');
}

export function findFavoriteGuide(
  favorite: Pick<RegionalGuideFavorite, 'selection' | 'targetId'>,
  guides: readonly RegionalDisposalGuide[],
): RegionalDisposalGuide | undefined {
  return guides.find(
    guide =>
      createRegionalGuideFavoriteTargetId(favorite.selection, guide) ===
      favorite.targetId,
  );
}

export function regionalGuideFavoriteIdentity(
  guide: RegionalDisposalGuide,
): RegionalGuideFavoriteIdentity {
  return compactIdentity({
    sidoName: normalize(guide.sidoName),
    sigunguName: normalize(guide.sigunguName),
    targetRegionName: normalize(guide.targetRegionName),
    managementZoneName: normalize(guide.managementZoneName),
    disposalPlaceType: normalize(guide.disposalPlaceType),
    managementNumber: normalize(guide.sourceMetadata?.managementNumber),
  });
}

export function isRegionalGuideFavorite(value: unknown): value is RegionalGuideFavorite {
  if (!isRecord(value)) return false;
  if (
    typeof value.targetId !== 'string' ||
    !value.targetId.startsWith(`${REGIONAL_GUIDE_FAVORITE_ID_PREFIX}|`) ||
    !isValidDate(value.savedAt) ||
    !isRegionSelection(value.selection) ||
    !isFavoriteIdentity(value.identity)
  ) {
    return false;
  }

  const guide: RegionalDisposalGuide = {
    ...value.identity,
    sourceMetadata: value.identity.managementNumber
      ? { managementNumber: value.identity.managementNumber }
      : undefined,
    schedules: [],
  };
  return (
    createRegionalGuideFavoriteTargetId(value.selection, guide) === value.targetId
  );
}

function encode(value: string | undefined): string {
  const normalized = normalize(value) ?? '';
  return `${normalized.length}:${normalized}`;
}

function normalize(value: string | undefined): string | undefined {
  const normalized = value?.normalize('NFKC').trim().replace(/\s+/g, ' ');
  return normalized ? normalized : undefined;
}

function compactIdentity(
  identity: RegionalGuideFavoriteIdentity,
): RegionalGuideFavoriteIdentity {
  return Object.fromEntries(
    Object.entries(identity).filter(([, value]) => value !== undefined),
  ) as RegionalGuideFavoriteIdentity;
}

function isFavoriteIdentity(value: unknown): value is RegionalGuideFavoriteIdentity {
  if (!isRecord(value)) return false;
  const keys = [
    'sidoName',
    'sigunguName',
    'targetRegionName',
    'managementZoneName',
    'disposalPlaceType',
    'managementNumber',
  ];
  return keys.every(key => value[key] === undefined || typeof value[key] === 'string');
}

function isRegionSelection(value: unknown): value is RegionSelection {
  if (!isRecord(value)) return false;
  return (
    isOptionalRegion(value.sido, 'sido') &&
    isOptionalRegion(value.sigungu, 'sigungu') &&
    isOptionalRegion(value.eupmyeondong, 'eupmyeondong') &&
    isRecord(value.sido) &&
    isRecord(value.sigungu)
  );
}

function isOptionalRegion(value: unknown, level: Region['level']): boolean {
  if (value === undefined) return true;
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    value.level === level &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    (value.parentId === undefined || typeof value.parentId === 'string')
  );
}

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
