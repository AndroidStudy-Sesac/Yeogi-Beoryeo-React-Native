import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from './routes';

const Stack = createNativeStackNavigator<RootStackParamList>();

function BootstrapScreen() {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        여기버려
      </Text>
      <Text style={styles.description}>공통 개발 환경이 준비되었습니다.</Text>
    </View>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        component={BootstrapScreen}
        name="Bootstrap"
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#111111',
    fontSize: 28,
    fontWeight: '700',
  },
  description: {
    color: '#444444',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
});
