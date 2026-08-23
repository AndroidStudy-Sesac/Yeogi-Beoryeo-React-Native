import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ItemGuide } from '../catalog';
import { colors, spacing } from '../theme';

type Props = Readonly<{
  item: ItemGuide;
  onPress: () => void;
}>;

function categoryLabel(item: ItemGuide): string {
  const categoryPath = item.categoryPaths[0];
  return categoryPath?.[categoryPath.length - 1] ?? '기타';
}

export function ItemResultCard({ item, onPress }: Props) {
  return (
    <Pressable
      accessibilityLabel={`${item.name} 상세 보기`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.content}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.category}>{categoryLabel(item)}</Text>
        {item.dischargeMethods[0] ? (
          <Text numberOfLines={2} style={styles.description}>
            {item.dischargeMethods[0]}
          </Text>
        ) : null}
      </View>
      <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.chevron}>
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: colors.outlineVariant,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  content: { flex: 1, gap: spacing.xs },
  name: { color: colors.onSurface, fontSize: 18, fontWeight: '800' },
  category: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  description: { color: colors.onSurfaceVariant, fontSize: 15, lineHeight: 21 },
  chevron: { color: colors.outline, fontSize: 32, paddingLeft: spacing.sm },
  pressed: { transform: [{ scale: 0.96 }] },
});
