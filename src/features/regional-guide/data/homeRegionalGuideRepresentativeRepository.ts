import AsyncStorage from '@react-native-async-storage/async-storage';

import { REGIONAL_GUIDE_FAVORITE_ID_PREFIX } from '../domain/regionalGuideFavorite';

export const HOME_REGIONAL_GUIDE_REPRESENTATIVE_STORAGE_KEY =
  '@yeogi-beoryeo/home-regional-guide-representative';
export const HOME_REGIONAL_GUIDE_REPRESENTATIVE_SCHEMA_VERSION = 1;

export type RepresentativeKeyValueStorage = Readonly<{
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}>;

export type HomeRegionalGuideRepresentativeRepository = Readonly<{
  load(): Promise<string | undefined>;
  save(targetId: string | undefined): Promise<void>;
}>;

type RepresentativeSchema = Readonly<{
  version: typeof HOME_REGIONAL_GUIDE_REPRESENTATIVE_SCHEMA_VERSION;
  targetId: string | null;
}>;

export function createHomeRegionalGuideRepresentativeRepository(
  storage: RepresentativeKeyValueStorage = AsyncStorage,
): HomeRegionalGuideRepresentativeRepository {
  return {
    async load() {
      const serialized = await storage.getItem(
        HOME_REGIONAL_GUIDE_REPRESENTATIVE_STORAGE_KEY,
      );
      if (serialized === null) return undefined;

      try {
        const schema: unknown = JSON.parse(serialized);
        return isRepresentativeSchema(schema) &&
          isRegionalGuideFavoriteTargetId(schema.targetId)
          ? schema.targetId
          : undefined;
      } catch {
        return undefined;
      }
    },
    async save(targetId) {
      const schema: RepresentativeSchema = {
        version: HOME_REGIONAL_GUIDE_REPRESENTATIVE_SCHEMA_VERSION,
        targetId: isRegionalGuideFavoriteTargetId(targetId) ? targetId : null,
      };
      await storage.setItem(
        HOME_REGIONAL_GUIDE_REPRESENTATIVE_STORAGE_KEY,
        JSON.stringify(schema),
      );
    },
  };
}

function isRepresentativeSchema(
  value: unknown,
): value is Readonly<{ version: 1; targetId: string | null }> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    value.version === HOME_REGIONAL_GUIDE_REPRESENTATIVE_SCHEMA_VERSION &&
    'targetId' in value &&
    (typeof value.targetId === 'string' || value.targetId === null)
  );
}

function isRegionalGuideFavoriteTargetId(
  value: string | null | undefined,
): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith(`${REGIONAL_GUIDE_FAVORITE_ID_PREFIX}|`)
  );
}
