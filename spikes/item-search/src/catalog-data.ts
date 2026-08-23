import rawItemGuides from './data/item_disposal_guides.json';
import rawSynonyms from './data/synonyms.json';
import { parseItemGuides, parseSynonyms, type ItemGuide } from './catalog';
import { searchItemGuides } from './search';

type Catalog = Readonly<{
  items: readonly ItemGuide[];
  synonyms: Readonly<Record<string, string>>;
}>;

let cachedCatalog: Catalog | undefined;

function getCatalog(): Catalog {
  if (cachedCatalog === undefined) {
    cachedCatalog = {
      items: parseItemGuides(rawItemGuides),
      synonyms: parseSynonyms(rawSynonyms),
    };
  }

  return cachedCatalog;
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
