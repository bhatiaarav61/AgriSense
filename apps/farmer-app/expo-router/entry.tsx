import 'expo-router/entry';
import { Providers } from '@/providers/Providers';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <Providers />
    </SafeAreaProvider>
  );
}