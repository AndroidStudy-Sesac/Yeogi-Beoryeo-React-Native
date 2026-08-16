import type { Region } from "./Region";

export function filterChildren(
  regions: readonly Region[],
  parentId: string,
): Region[] {
  return regions.filter((region) => region.parentId === parentId);
}

export function filterByName(
  regions: readonly Region[],
  query: string,
): Region[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [...regions];

  return regions.filter((region) => region.name.includes(normalizedQuery));
}
