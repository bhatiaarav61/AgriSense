import React from 'react';
import { Providers } from '@/providers/Providers';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <Providers>
        <AppContent />
      </Providers>
    </SafeAreaProvider>
  );
}

function AppContent() {
  return (
    <React.Suspense fallback={<LoadingScreen />}>
      <NavigationContainer />
    </React.Suspense>
  );
}

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <Text style={styles.loadingText}>Loading AgriSense...</Text>
    </View>
  );
}

// This will be replaced by expo-router
function NavigationContainer() {
  return (
    <Text>Navigation handled by expo-router</Text>
  );
}

import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#10B981',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});