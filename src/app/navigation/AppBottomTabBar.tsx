import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { StyleSheet, Text, useColorScheme, useWindowDimensions, View } from 'react-native';

import { getScreenSelectedBottomTab } from './navigationPolicy';

export function AppBottomTabBar(props: BottomTabBarProps) {
  const colors = useColorScheme() === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  const { fontScale } = useWindowDimensions();
  const height = Math.max(80, 40 + 16 * fontScale) + props.insets.bottom;
  const selectedTab = getScreenSelectedBottomTab(props.state);
  const descriptors = Object.fromEntries(
    Object.entries(props.descriptors).map(([key, descriptor], index, entries) => {
      const selected = descriptor.route.name === selectedTab;
      const iconColor = selected ? colors.selectedIcon : colors.inactive;
      return [
        key,
        {
          ...descriptor,
          options: {
            ...descriptor.options,
            tabBarStyle: [
              styles.bar,
              { backgroundColor: colors.surface, height },
              descriptor.options.tabBarStyle,
            ],
            tabBarItemStyle: { marginRight: index < entries.length - 1 ? 8 : 0 },
            tabBarButton: buttonProps => (
              <PlatformPressable
                {...buttonProps}
                aria-selected={selected}
                style={[buttonProps.style, styles.button]}
              >
                <View
                  style={[
                    styles.indicator,
                    { backgroundColor: selected ? colors.indicator : 'transparent' },
                  ]}
                  testID={`bottom-tab-indicator-${descriptor.route.name}`}
                >
                  {descriptor.options.tabBarIcon?.({
                    focused: selected,
                    color: iconColor,
                    size: 24,
                  })}
                </View>
                <Text style={[
                  styles.label,
                  { color: selected ? colors.selectedLabel : colors.inactive },
                ]}>
                  {descriptor.options.title}
                </Text>
              </PlatformPressable>
            ),
          },
        } satisfies typeof descriptor,
      ];
    }),
  );

  return <BottomTabBar {...props} descriptors={descriptors} />;
}

// Original v1.1.0 uses Material 3 1.4.0 NavigationBar defaults and Pretendard.
const LIGHT_COLORS = {
  surface: '#FAFAF7',
  indicator: '#E8F5E0',
  selectedIcon: '#173A08',
  selectedLabel: '#64B433',
  inactive: '#424940',
};
const DARK_COLORS = {
  surface: '#1E211D',
  indicator: '#365F1D',
  selectedIcon: '#E8F5E0',
  selectedLabel: '#64B433',
  inactive: '#C1C9C0',
};

const styles = StyleSheet.create({
  bar: { borderTopWidth: 0, elevation: 0, paddingTop: 0 },
  button: {
    flexDirection: 'column',
    justifyContent: 'center',
    padding: 0,
    paddingBottom: 4,
    gap: 4,
  },
  indicator: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 32,
    borderRadius: 16,
  },
  label: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
    includeFontPadding: false,
  },
});
