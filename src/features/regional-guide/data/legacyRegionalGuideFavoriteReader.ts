import { requireOptionalNativeModule } from "expo-modules-core";

export interface LegacyRegionalGuideFavoriteReader {
  read(): Promise<unknown>;
}

interface LegacyRegionalGuideFavoritesNativeModule {
  read(): Promise<unknown>;
}

export function createLegacyRegionalGuideFavoriteReader(): LegacyRegionalGuideFavoriteReader {
  const nativeModule =
    requireOptionalNativeModule<LegacyRegionalGuideFavoritesNativeModule>(
      "LegacyRegionalGuideFavorites",
    );

  return {
    async read() {
      if (nativeModule === null) return { status: "unavailable" };
      return nativeModule.read();
    },
  };
}
