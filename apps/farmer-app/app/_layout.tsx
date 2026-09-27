import { Slot } from 'expo-router';
import { Providers } from '@/providers/Providers';

export default function RootLayout() {
  return (
    <Providers>
      <Slot />
    </Providers>
  );
}