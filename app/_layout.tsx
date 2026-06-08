import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import '../global.css';
import { runMigrations } from '@/src/db/migrate';
import { seedDatabase } from '@/src/db/seed';
import { useAuthStore } from '@/src/store/authStore';
import { useSyncStore } from '@/src/store/syncStore';
import { useSettingsStore } from '@/src/store/settingsStore';
import { initVoice } from '@/src/services/voice/recorder';

const queryClient = new QueryClient();

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const { init: initAuth, currentUser, isLoading: authLoading } = useAuthStore();
  const { init: initSync } = useSyncStore();
  const { init: initSettings } = useSettingsStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initVoice().catch((e) => console.warn('Whisper init failed:', e));
  }, []);

  useEffect(() => {
    (async () => {
      await runMigrations();
      await seedDatabase();
      await initAuth();
      await initSync();
      await initSettings();
      setDbReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!dbReady || authLoading) return;
    const inAuth = segments[0] === '(auth)';
    if (!currentUser && !inAuth) {
      router.replace('/(auth)/login');
    } else if (currentUser && inAuth) {
      router.replace('/(tabs)');
    }
  }, [currentUser, segments, dbReady, authLoading]);

  if (!dbReady || authLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#C8A96E" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0F0F0F' } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
