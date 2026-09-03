import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createHomeRegionalGuideRepresentativeRepository,
  type HomeRegionalGuideRepresentativeRepository,
} from "./homeRegionalGuideRepresentativeRepository";

export function createAsyncStorageHomeRegionalGuideRepresentativeRepository(): HomeRegionalGuideRepresentativeRepository {
  return createHomeRegionalGuideRepresentativeRepository(AsyncStorage);
}
