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
