import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  BackHandler,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../../App';
import { colors, spacing } from '../theme';
import { getUsefulGuide } from '../useful-guides';

type Props = NativeStackScreenProps<RootStackParamList, 'UsefulGuide'>;

export function UsefulGuideScreen({ navigation, route }: Props) {
  const guide = getUsefulGuide(route.params.guideId);
  const [linkError, setLinkError] = useState<string>();

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        navigation.goBack();
        return true;
      });

      return () => subscription.remove();
    }, [navigation]),
  );

  async function openSite(label: string, url: string) {
    setLinkError(undefined);
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error('Unsupported URL');
      await Linking.openURL(url);
    } catch {
      setLinkError(`${label}을 열지 못했어요. 잠시 후 다시 시도해주세요.`);
    }
  }

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text allowFontScaling={false} style={styles.backLabel}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.headerTitle}>
          {guide.label}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text accessibilityRole="header" style={styles.title}>{guide.title}</Text>
          <Text style={styles.description}>{guide.description}</Text>
        </View>

        <GuideSection title="확인할 내용" text={guide.detail} />
        <GuideSection title="배출 전 확인" text={guide.caution} />

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>관련 사이트</Text>
          {guide.sites.map((site) => (
            <Pressable
              accessibilityHint="외부 브라우저로 이동합니다."
              accessibilityRole="link"
              key={site.url}
              onPress={() => void openSite(site.label, site.url)}
              style={({ pressed }) => [styles.siteButton, pressed && styles.pressed]}
            >
              <Text style={styles.siteLabel}>{site.label}</Text>
              <Text allowFontScaling={false} style={styles.siteArrow}>↗</Text>
            </Pressable>
          ))}
          {linkError ? (
            <Text accessibilityLiveRegion="assertive" style={styles.errorText}>{linkError}</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function GuideSection({ text, title }: Readonly<{ text: string; title: string }>) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomColor: colors.outlineVariant,
    borderBottomWidth: 1,
    paddingHorizontal: spacing.sm,
  },
  backButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  backLabel: { color: colors.onSurface, fontSize: 40, lineHeight: 42 },
  headerTitle: { flex: 1, color: colors.onSurface, fontSize: 20, fontWeight: '800', paddingRight: 48 },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  hero: { borderRadius: 22, backgroundColor: colors.secondaryContainer, padding: spacing.lg, gap: spacing.sm },
  title: { color: colors.onPrimaryContainer, fontSize: 24, fontWeight: '800', lineHeight: 32 },
  description: { color: colors.onSurfaceVariant, fontSize: 16, lineHeight: 24 },
  section: {
    borderColor: colors.outlineVariant,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: { color: colors.onSurface, fontSize: 18, fontWeight: '800' },
  sectionText: { color: colors.onSurfaceVariant, fontSize: 16, lineHeight: 25 },
  siteButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: spacing.md,
  },
  siteLabel: { flex: 1, color: colors.primary, fontSize: 16, fontWeight: '700' },
  siteArrow: { color: colors.primary, fontSize: 20, fontWeight: '800' },
  errorText: { color: colors.error, fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
