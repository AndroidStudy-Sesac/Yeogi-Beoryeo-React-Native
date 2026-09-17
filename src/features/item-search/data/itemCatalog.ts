import type { ItemGuide } from '../domain/itemGuide';
import { ItemSearchIndex } from '../domain/itemSearch';
import rawItems from './assets/item_disposal_guides.json';
import rawSynonyms from './assets/synonyms.json';

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${path} must be a non-empty string.`);
  }
  return value;
}

function strings(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array.`);
  return Object.freeze(value.map((entry, index) => text(entry, `${path}[${index}]`)));
}

export function parseItemGuides(value: unknown): readonly ItemGuide[] {
  if (!Array.isArray(value)) throw new TypeError('items must be an array.');
  const ids = new Set<string>();

  return Object.freeze(
    value.map((entry, index) => {
      const path = `items[${index}]`;
      const item = record(entry, path);
      const id = text(item.id, `${path}.id`);
      if (ids.has(id)) throw new TypeError(`${path}.id duplicates ${id}.`);
      ids.add(id);

      if (!Array.isArray(item.categoryPaths) || item.categoryPaths.length === 0) {
        throw new TypeError(`${path}.categoryPaths must be a non-empty array.`);
      }
      const categoryPaths = item.categoryPaths.map((entry, index) => {
        const categoryPath = `${path}.categoryPaths[${index}]`;
        const labels = strings(entry, categoryPath);
        if (labels.length === 0) throw new TypeError(`${categoryPath} must not be empty.`);
        return labels;
      });

      return Object.freeze({
        id,
        name: text(item.name, `${path}.name`),
        legacyNames: strings(
          item.legacyNames === undefined ? [] : item.legacyNames,
          `${path}.legacyNames`,
        ),
        categoryPaths: Object.freeze(categoryPaths),
        similarItems: strings(item.similarItems, `${path}.similarItems`),
        dischargeMethods: strings(item.dischargeMethods, `${path}.dischargeMethods`),
        features: strings(item.features, `${path}.features`),
        notes: strings(item.notes, `${path}.notes`),
      });
    }),
  );
}

export function parseSynonyms(value: unknown): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(record(value, 'synonyms')).map(([alias, target]) => [
        text(alias, 'synonyms key'),
        text(target, `synonyms.${alias}`),
      ]),
    ),
  );
}

let bundledIndex: ItemSearchIndex | undefined;

export function loadItemCatalog(): ItemSearchIndex {
  bundledIndex ??= new ItemSearchIndex(parseItemGuides(rawItems), parseSynonyms(rawSynonyms));
  return bundledIndex;
}
