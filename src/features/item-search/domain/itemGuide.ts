export type ItemGuide = Readonly<{
  id: string;
  name: string;
  legacyNames: readonly string[];
  categoryPaths: readonly (readonly string[])[];
  similarItems: readonly string[];
  dischargeMethods: readonly string[];
  features: readonly string[];
  notes: readonly string[];
  sections?: readonly Readonly<{
    title: string;
    lines: readonly string[];
    rows: readonly Readonly<{ label: string; value: string }>[];
  }>[];
  relatedSpotTypes?: readonly string[];
}>;
