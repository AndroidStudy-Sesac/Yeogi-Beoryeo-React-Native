import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { useTheme } from '@react-navigation/native';

import { getScreenSelectedBottomTab } from './navigationPolicy';

export function AppBottomTabBar(props: BottomTabBarProps) {
  const { colors } = useTheme();
  const selectedTab = getScreenSelectedBottomTab(props.state);
  const descriptors = Object.fromEntries(
    Object.entries(props.descriptors).map(([key, descriptor]) => {
      const selected = descriptor.route.name === selectedTab;
      const color = selected ? colors.primary : colors.text;
      return [
        key,
        {
          ...descriptor,
          options: {
            ...descriptor.options,
            tabBarButton: buttonProps => (
              <PlatformPressable {...buttonProps} aria-selected={selected} />
            ),
            tabBarIcon: iconProps => descriptor.options.tabBarIcon?.({
              ...iconProps,
              focused: selected,
              color,
            }),
            tabBarLabelStyle: [descriptor.options.tabBarLabelStyle, { color }],
          },
        } satisfies typeof descriptor,
      ];
    }),
  );

  return <BottomTabBar {...props} descriptors={descriptors} />;
}
