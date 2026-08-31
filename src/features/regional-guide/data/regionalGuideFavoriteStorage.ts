import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createRegionalGuideFavoriteRepository,
  type RegionalGuideFavoriteRepository,
} from "./regionalGuideFavoriteRepository";

export function createAsyncStorageRegionalGuideFavoriteRepository(): RegionalGuideFavoriteRepository {
  return createRegionalGuideFavoriteRepository(AsyncStorage);
}
