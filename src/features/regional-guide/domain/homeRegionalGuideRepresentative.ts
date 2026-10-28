import type { RegionalGuideFavorite } from './regionalGuideFavorite';

export function resolveHomeRegionalGuideRepresentative(
  targetId: string | undefined,
  favorites: readonly RegionalGuideFavorite[],
): RegionalGuideFavorite | undefined {
  if (!targetId) return undefined;
  return favorites.find(favorite => favorite.targetId === targetId);
}
