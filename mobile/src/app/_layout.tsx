import 'react-native-get-random-values';
import '@/i18n';

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: definePokeBackgroundTask() must be at module scope (outside any
// React component) so the TaskManager task is registered before the JS
// runtime finishes initialising.
// ─────────────────────────────────────────────────────────────────────────────
import { definePokeBackgroundTask } from '@/services/notificationService';
definePokeBackgroundTask();

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
import { usePokeStore } from '@/store/usePokeStore';
import { View, ActivityIndicator } from 'react-native';
import {
  registerForPushNotificationsAsync,
  registerPokeCategory,
  schedulePokeNotification,
} from '@/services/notificationService';
import { useTranslation } from 'react-i18next';

function AppContent() {
  const { theme } = useTheme();
  const { t } = useTranslation();
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
  const userId = useSyncStore((s) => s.userId);
  const partners = useSyncStore((s) => s.partners);
  const registerPushToken = useSyncStore((s) => s.registerPushToken);
  const slots = usePokeStore((s) => s.slots);

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

  // Register push token and set up persistent poke notification
  useEffect(() => {
    if (!userId) return;

    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          await registerPushToken(token);
        }

        const activePartner = partners.find(p => p.status === 'active');
        if (activePartner) {
          const getLabel = (key: string) => t(`poke.messages.${key}`, { defaultValue: key });
          await registerPokeCategory(slots, getLabel);
          await schedulePokeNotification(
            {
              partnerId: activePartner.id,
              partnerName: activePartner.alias,
              slots,
            },
            t('poke.notifTitle'),
            t('poke.notifBody', { name: activePartner.alias })
          );
        }
      } catch (err: any) {
        console.error('[_layout] Notification setup error:', err.message);
      }
    })();
  }, [userId, partners.length]);

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
