import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type AppTab = "home" | "map" | "guide" | "saved";

interface BottomNavigationProps {
  selectedTab: AppTab;
  onSelect: (tab: AppTab) => void;
}

const items: { tab: AppTab; icon: string; label: string }[] = [
  { tab: "home", icon: "♻", label: "홈" },
  { tab: "map", icon: "⌖", label: "지도" },
  { tab: "guide", icon: "ⓘ", label: "안내" },
  { tab: "saved", icon: "☆", label: "저장" },
];

export function BottomNavigation({
  selectedTab,
  onSelect,
}: BottomNavigationProps) {
  return (
    <SafeAreaView
      accessibilityRole="tablist"
      edges={["bottom"]}
      style={styles.container}
    >
      {items.map((item) => {
        const selected = item.tab === selectedTab;
        return (
          <Pressable
            key={item.tab}
            accessibilityLabel={`${item.label} 탭`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onSelect(item.tab)}
            style={styles.item}
          >
            <View
              style={[styles.iconContainer, selected && styles.selectedIcon]}
            >
              <Text style={[styles.icon, selected && styles.selectedText]}>
                {item.icon}
              </Text>
            </View>
            <Text style={[styles.label, selected && styles.selectedText]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderTopColor: "#EEF0EB",
    borderTopWidth: 1,
    flexDirection: "row",
    paddingBottom: 8,
    paddingTop: 8,
  },
  item: { alignItems: "center", flex: 1, gap: 2 },
  iconContainer: {
    alignItems: "center",
    borderRadius: 20,
    height: 34,
    justifyContent: "center",
    width: 52,
  },
  selectedIcon: { backgroundColor: "#EAF6E1" },
  icon: { color: "#424A42", fontSize: 27, fontWeight: "700" },
  label: { color: "#424A42", fontSize: 13, fontWeight: "600" },
  selectedText: { color: "#3AA52E" },
});
