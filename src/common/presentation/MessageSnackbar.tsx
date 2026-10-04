import { StyleSheet, Text, View } from 'react-native';

import { ErrorOutlineIcon } from './StatusIcons';

export function MessageSnackbar({ message }: Readonly<{ message: string }>) {
  return (
    <View
      accessibilityLabel={message}
      accessibilityLiveRegion="assertive"
      style={styles.container}
    >
      <ErrorOutlineIcon color={COLORS.tertiary} size={20} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const COLORS = {
  onTertiaryContainer: '#4E3400',
  tertiary: '#F9A825',
  tertiaryContainer: '#FFECB3',
} as const;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: COLORS.tertiaryContainer,
    borderRadius: 12,
    bottom: 16,
    flexDirection: 'row',
    gap: 12,
    left: 16,
    padding: 16,
    position: 'absolute',
    right: 16,
  },
  message: {
    color: COLORS.onTertiaryContainer,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
