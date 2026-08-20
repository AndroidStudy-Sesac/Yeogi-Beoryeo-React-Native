import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>여기버려 React Native Spike</Text>
      <Text style={styles.description}>Android 기본 실행 환경 확인 완료</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7FAF8',
    padding: 24,
  },
  title: {
    color: '#12312A',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    marginTop: 12,
    color: '#4F635D',
    fontSize: 16,
    textAlign: 'center',
  },
});
