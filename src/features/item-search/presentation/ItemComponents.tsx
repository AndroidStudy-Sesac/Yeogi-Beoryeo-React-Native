import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type TextProps, useWindowDimensions, View } from 'react-native';
import Svg, { Path, type PathProps } from 'react-native-svg';

import type { ItemGuide } from '../domain/itemGuide';
import icons from './assets/itemIcons.json';
import { getItemDisplay, itemReadableText, itemText } from './itemDisplay';
import { itemFonts, useItemColors, usesLargeItemTypography } from './itemTheme';

export function ItemText({ children, ...props }: Omit<TextProps, 'children'> & { children: string }) {
  return <Text accessible {...props} accessibilityLabel={itemReadableText(children)}>
    {itemText(children).replace(/([가-힣])/g, '$1\u200B')}
  </Text>;
}

export function ItemIcon({ name, color, size = 24 }: {
  name: keyof typeof icons;
  color: string;
  size?: number;
}) {
  const icon = icons[name];
  return <Svg width={size} height={size} viewBox={icon.viewBox} color={color} accessible={false}>
    {icon.paths.map((path, index) => <Path key={index} {...path as PathProps} />)}
  </Svg>;
}

export function ItemTopBar({ title, onBack, children }: PropsWithChildren<{
  title?: string;
  onBack?: () => void;
}>) {
  const colors = useItemColors();
  return <View style={styles.topBar}>
    {onBack && <Pressable accessibilityRole="button" accessibilityLabel="뒤로가기" onPress={onBack}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}>
      <ItemIcon name="action_back" color={colors.text} />
    </Pressable>}
    {title ? <Text accessibilityRole="header" style={[styles.topTitle, { color: colors.text }]}>{title}</Text> : <View style={styles.spacer} />}
    {children}
  </View>;
}

export function ItemMetadata({ guide }: { guide: ItemGuide }) {
  const colors = useItemColors();
  const display = getItemDisplay(guide);
  return <View style={styles.chips}>
    {display.disposalRoute && <View accessible accessibilityLabel={display.disposalRoute}
      style={[styles.chip, display.disposalRoute !== '전용 수거' && styles.iconChip, { backgroundColor: display.disposalRoute === '신고 후 배출' ? colors.tertiaryContainer
        : display.disposalRoute === '전용 수거' ? colors.primaryContainer : colors.secondaryContainer }]}>
      {display.disposalRoute === '재활용 분리배출'
        ? <ItemIcon name="symbol_recycle" size={20} color={colors.onSecondaryContainer} />
        : display.disposalRoute === '신고 후 배출'
          ? <ItemIcon name="disposal_route_report" size={20} color={colors.onTertiaryContainer} />
          : <Text style={[styles.chipText, { color: colors.onPrimaryContainer }]}>{display.disposalRoute}</Text>}
    </View>}
    {[display.categoryLabel, display.subcategory].filter(Boolean).map(label =>
      <View key={label} style={[styles.chip, { backgroundColor: colors.secondaryContainer }]}>
        <Text style={[styles.chipText, { color: colors.onSecondaryContainer }]}>{label}</Text>
      </View>)}
  </View>;
}

export function ItemStatus({ loading, title, description, onRetry }: {
  loading?: boolean;
  title: string;
  description?: string;
  onRetry?: () => void;
}) {
  const colors = useItemColors();
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" accessibilityLabel="로딩 중" /></View>;
  return <View style={styles.status} accessibilityLiveRegion="polite">
    <ItemText accessibilityRole="header" style={[styles.statusTitle, { color: colors.text }]}>{title}</ItemText>
    {description && <ItemText style={[styles.description, { color: colors.muted }]}>{description}</ItemText>}
    {onRetry && <Pressable accessibilityRole="button" onPress={onRetry}
      style={({ pressed }) => [styles.retry, { backgroundColor: colors.primary, opacity: pressed ? 0.6 : 1 }]}>
      <Text style={[styles.retryText, { color: colors.onPrimary }]}>다시 시도</Text>
    </Pressable>}
  </View>;
}

export function ItemSection({ title, lines }: { title: string; lines: readonly string[] }) {
  const colors = useItemColors();
  const { fontScale } = useWindowDimensions();
  return <View style={[styles.section, { borderColor: colors.outline }]}>
    <ItemText accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }, usesLargeItemTypography(fontScale) && styles.largeSectionTitle]}>{title}</ItemText>
    <View style={styles.sectionLines}>
      {lines.map((line, index) => <ItemText key={index} style={[styles.body, { color: colors.muted },
        usesLargeItemTypography(fontScale) && styles.largeBody]}>{line}</ItemText>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  spacer: { flex: 1 },
  topBar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, fontFamily: itemFonts.bold, fontSize: 24, lineHeight: 32, paddingVertical: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, minHeight: 36, justifyContent: 'center' },
  iconChip: { paddingHorizontal: 8 },
  chipText: { fontFamily: itemFonts.medium, fontSize: 14, lineHeight: 20 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  status: { alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 32 },
  statusTitle: { fontFamily: itemFonts.semibold, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  description: { fontFamily: itemFonts.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retry: { minHeight: 48, borderRadius: 24, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontFamily: itemFonts.medium, fontSize: 14, lineHeight: 20 },
  section: { borderWidth: 1, borderRadius: 28, padding: 23, gap: 12 },
  sectionLines: { gap: 8 },
  sectionTitle: { fontFamily: itemFonts.bold, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: itemFonts.regular, fontSize: 16, lineHeight: 24 },
  largeSectionTitle: { fontSize: 22, lineHeight: 28 },
  largeBody: { fontFamily: itemFonts.medium },
});
