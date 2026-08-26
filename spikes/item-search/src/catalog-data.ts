import rawItemGuides from './data/item_disposal_guides.json';
import rawSynonyms from './data/synonyms.json';
import { parseItemGuides, parseSynonyms, type ItemGuide } from './catalog';
import { searchItemGuides } from './search';
import {
  measureSearchPerformance,
  type SearchPerformanceMeasurement,
} from './search-performance';

type Catalog = Readonly<{
  items: readonly ItemGuide[];
  synonyms: Readonly<Record<string, string>>;
}>;

let cachedCatalog: Catalog | undefined;
let catalogValidationMs: number | undefined;

function getCatalog(): Catalog {
  if (cachedCatalog === undefined) {
    const startedAt = globalThis.performance.now();
    cachedCatalog = {
      items: parseItemGuides(rawItemGuides),
      synonyms: parseSynonyms(rawSynonyms),
    };
    catalogValidationMs = globalThis.performance.now() - startedAt;
  }

  return cachedCatalog;
}

export type BundledCatalogPerformance = Readonly<{
  itemCount: number;
  catalogValidationMs: number;
  samplesPerQuery: number;
  searches: readonly SearchPerformanceMeasurement[];
}>;

export function measureBundledCatalogPerformance(
  queries: readonly string[],
  sampleCount: number,
): BundledCatalogPerformance {
  const catalog = getCatalog();

  return {
    itemCount: catalog.items.length,
    catalogValidationMs:
      Math.round((catalogValidationMs ?? 0) * 1000) / 1000,
    samplesPerQuery: sampleCount,
    searches: measureSearchPerformance(
      catalog.items,
      catalog.synonyms,
      queries,
      sampleCount,
    ),
  };
}

export async function searchBundledCatalog(
  query: string,
  signal: AbortSignal,
): Promise<ItemGuide[]> {
  await Promise.resolve();
  if (signal.aborted) throw new DOMException('Search aborted.', 'AbortError');

  const catalog = getCatalog();
  if (signal.aborted) throw new DOMException('Search aborted.', 'AbortError');

  return searchItemGuides(catalog.items, catalog.synonyms, query);
}

export function getBundledItemGuide(itemId: string): ItemGuide | undefined {
  return getCatalog().items.find((item) => item.id === itemId);
}

export function getBundledItemGuides(): readonly ItemGuide[] {
  return getCatalog().items;
}
