import 'react-native-get-random-values';
import '@/i18n';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { LockScreen } from '@/components/LockScreen';
import { usePrivacyLock } from '@/hooks/usePrivacyLock';
import { initDatabase } from '@/db/schema';
import { useContactsStore } from '@/store/useContactsStore';
import { useSyncStore } from '@/store/useSyncStore';
import { View, ActivityIndicator } from 'react-native';

function AppContent() {
  const { theme } = useTheme();
  const c = theme.colors;
  const {
    isLocked,
    isReady,
    isBiometricEnabled,
    unlockWithBiometric,
    unlockWithPin,
  } = usePrivacyLock();
  const loadContacts = useContactsStore((s) => s.loadContacts);

  const initSync = useSyncStore((s) => s.init);
  const sync = useSyncStore((s) => s.sync);

  useEffect(() => {
    initDatabase()
      .then(async () => {
        await loadContacts();
        return initSync();
      })
      .then(() => {
        // Initial sync
        sync().catch(console.error);
      })
      .catch((err) => {
        console.error('APP INIT ERROR:', err);
      });
  }, []);

  // Periodic sync every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      sync().catch(console.error);
    }, 60000);
    return () => clearInterval(interval);
  }, [sync]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.primary} size="large" />
      </View>
    );
  }

  if (isLocked) {
    return (
      <LockScreen
        hasBiometric={isBiometricEnabled()}
        onUnlockWithBiometric={unlockWithBiometric}
        onUnlockWithPin={unlockWithPin}
      />
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal/log-event" options={{ presentation: 'modal' }} />
        <Stack.Screen name="modal/event-detail" options={{ presentation: 'modal' }} />
        <Stack.Screen name="modal/add-contact" options={{ presentation: 'modal' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
