export type ItemGuide = Readonly<{
  id: string;
  name: string;
  legacyNames: readonly string[];
  categoryPaths: readonly (readonly string[])[];
  similarItems: readonly string[];
  dischargeMethods: readonly string[];
  features: readonly string[];
  notes: readonly string[];
}>;

type JsonObject = Record<string, unknown>;

function objectAt(value: unknown, path: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object.`);
  }

  return value as JsonObject;
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${path} must be a non-empty string.`);
  }

  return value;
}

function stringArrayAt(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${path} must be an array.`);
  }

  return value.map((entry, index) => stringAt(entry, `${path}[${index}]`));
}

export function parseItemGuides(value: unknown): ItemGuide[] {
  if (!Array.isArray(value)) {
    throw new TypeError('Item guide data must be an array.');
  }

  return value.map((entry, index) => {
    const path = `items[${index}]`;
    const item = objectAt(entry, path);

    if (!Array.isArray(item.categoryPaths)) {
      throw new TypeError(`${path}.categoryPaths must be an array.`);
    }

    return {
      id: stringAt(item.id, `${path}.id`),
      name: stringAt(item.name, `${path}.name`),
      legacyNames:
        item.legacyNames === undefined
          ? []
          : stringArrayAt(item.legacyNames, `${path}.legacyNames`),
      categoryPaths: item.categoryPaths.map((categoryPath, categoryIndex) =>
        stringArrayAt(categoryPath, `${path}.categoryPaths[${categoryIndex}]`),
      ),
      similarItems: stringArrayAt(item.similarItems, `${path}.similarItems`),
      dischargeMethods: stringArrayAt(
        item.dischargeMethods,
        `${path}.dischargeMethods`,
      ),
      features: stringArrayAt(item.features, `${path}.features`),
      notes: stringArrayAt(item.notes, `${path}.notes`),
    };
  });
}

export function parseSynonyms(value: unknown): Readonly<Record<string, string>> {
  const synonyms = objectAt(value, 'synonyms');

  return Object.fromEntries(
    Object.entries(synonyms).map(([alias, canonical]) => [
      stringAt(alias, 'synonyms key'),
      stringAt(canonical, `synonyms.${alias}`),
    ]),
  );
}
