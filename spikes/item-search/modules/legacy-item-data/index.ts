import { requireOptionalNativeModule } from 'expo-modules-core';

import type { LegacyItemDataModule } from '../../src/legacy-item-data-migration';

export default requireOptionalNativeModule<LegacyItemDataModule>(
  'LegacyItemData',
);
