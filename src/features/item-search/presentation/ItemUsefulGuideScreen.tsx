import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ItemSection, ItemText, ItemTopBar } from './ItemComponents';
import { itemFonts, useItemColors } from './itemTheme';
import { freePickupUrl, usefulGuides, type UsefulGuideType } from './usefulGuides';

export function ItemUsefulGuideScreen({ type, onBack, onAction }: {
  type: UsefulGuideType; onBack: () => void; onAction: (type: UsefulGuideType) => void;
}) {
  const colors = useItemColors();
  const guide = usefulGuides.find(guide => guide.type === type)!;
  const [linkError, setLinkError] = useState(false);
  async function open(url: string) {
    try { await Linking.openURL(url); setLinkError(false); } catch { setLinkError(true); }
  }
  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <ItemTopBar title={guide.title} onBack={onBack} />
    <ScrollView contentContainerStyle={styles.content}>
      <ItemText style={[styles.body, { color: colors.muted }]}>{guide.description}</ItemText>
      <ItemSection title={guide.detailTitle} lines={guide.details} />
      <ItemSection title="주의사항" lines={guide.cautions} />
      <Pressable accessibilityRole="button" accessibilityLabel={guide.cta} onPress={() => onAction(type)}
        style={[styles.button, { backgroundColor: colors.primary }]}>
        <ItemText style={[styles.label, { color: colors.onPrimary }]}>{guide.cta}</ItemText>
      </Pressable>
      {type === 'SMALL_E_WASTE' && <Pressable accessibilityRole="link" accessibilityLabel="무상방문수거 안내 보기"
        onPress={() => { void open(freePickupUrl); }} style={[styles.button, { borderColor: colors.outline, borderWidth: 1 }]}>
        <Text style={[styles.label, { color: colors.primary }]}>무상방문수거 안내 보기</Text>
      </Pressable>}
      <Text accessibilityRole="header" style={[styles.label, { color: colors.text }]}>관련 사이트</Text>
      {guide.sites.map(site => <Pressable key={site.url} accessibilityRole="link" accessibilityLabel={site.label}
        onPress={() => { void open(site.url); }} style={[styles.button, { borderColor: colors.outline, borderWidth: 1 }]}>
        <ItemText style={[styles.label, { color: colors.primary }]}>{site.label}</ItemText>
      </Pressable>)}
      {linkError && <Text accessibilityRole="alert" style={[styles.body, { color: colors.onErrorContainer }]}>링크를 열지 못했어요. 다시 시도해 주세요.</Text>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingBottom: 32, gap: 16 },
  body: { fontFamily: itemFonts.regular, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: itemFonts.bold, fontSize: 16, lineHeight: 24 },
  button: { minHeight: 48, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
