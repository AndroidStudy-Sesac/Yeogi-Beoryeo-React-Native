import { useColorScheme } from 'react-native';

import type { ItemCategory } from './itemDisplay';

export const itemFonts = {
  regular: 'Pretendard-Regular', medium: 'Pretendard-Medium',
  semibold: 'Pretendard-SemiBold', bold: 'Pretendard-Bold', extraBold: 'Pretendard-ExtraBold',
};

// Android sends its Float font scale as a Double, including Float rounding.
export function usesLargeItemTypography(fontScale: number) {
  return fontScale >= Math.fround(1.3);
}

const lightColors = {
  background: '#FFFFFF', text: '#1A1C19', muted: '#424940', outline: '#DDE5DD', fieldOutline: '#737A70',
  primary: '#2E7D32', onPrimary: '#FFFFFF', primaryContainer: '#C8E6C9', onPrimaryContainer: '#0B3D0E',
  secondaryContainer: '#E8F5E0', onSecondaryContainer: '#173A08',
  tertiaryContainer: '#FFECB3', onTertiaryContainer: '#4E3400',
  errorContainer: '#FFDAD6', onErrorContainer: '#7A0000', surfaceVariant: '#DDE5DD',
};

const darkColors: typeof lightColors = {
  background: '#121411', text: '#E2E3DF', muted: '#C1C9C0', outline: '#424940', fieldOutline: '#8B9388',
  primary: '#8EDB91', onPrimary: '#00390A', primaryContainer: '#1D5F22', onPrimaryContainer: '#C8E6C9',
  secondaryContainer: '#365F1D', onSecondaryContainer: '#E8F5E0',
  tertiaryContainer: '#8A6400', onTertiaryContainer: '#FFECB3',
  errorContainer: '#9F1F1F', onErrorContainer: '#FFDAD6', surfaceVariant: '#424940',
};

export function useItemColors() {
  return useColorScheme() === 'dark' ? darkColors : lightColors;
}

export function categoryColors(category: ItemCategory, colors: typeof lightColors) {
  switch (category) {
    case 'construction_waste': case 'hazardous':
      return { backgroundColor: colors.errorContainer, color: colors.onErrorContainer };
    case 'metal': case 'colorless_pet': case 'glass_bottle': case 'electronics': case 'plastic':
      return { backgroundColor: colors.primaryContainer, color: colors.onPrimaryContainer };
    case 'large_waste': case 'vinyl': case 'clothing': case 'lighting':
      return { backgroundColor: colors.tertiaryContainer, color: colors.onTertiaryContainer };
    case 'non_combustible': case 'general_waste': case 'other':
      return { backgroundColor: colors.surfaceVariant, color: colors.muted };
    default:
      return { backgroundColor: colors.secondaryContainer, color: colors.onSecondaryContainer };
  }
}
