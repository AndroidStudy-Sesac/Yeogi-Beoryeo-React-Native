import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createRegionalGuideFavoriteRepository,
  type RegionalGuideFavoriteRepository,
} from "./regionalGuideFavoriteRepository";
import { createLegacyRegionalGuideFavoriteReader } from "./legacyRegionalGuideFavoriteReader";
import { createMigratingRegionalGuideFavoriteRepository } from "./regionalGuideFavoriteMigration";

export function createAsyncStorageRegionalGuideFavoriteRepository(): RegionalGuideFavoriteRepository {
  const repository = createRegionalGuideFavoriteRepository(AsyncStorage);
  return createMigratingRegionalGuideFavoriteRepository(
    repository,
    AsyncStorage,
    createLegacyRegionalGuideFavoriteReader(),
  );
}
