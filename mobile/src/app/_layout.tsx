import 'react-native-get-random-values';
import '@/i18n';

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: definePokeBackgroundTask() must be at module scope (outside any
// React component) so the TaskManager task is registered before the JS
// runtime finishes initialising.
// ─────────────────────────────────────────────────────────────────────────────
import { definePokeBackgroundTask } from '@/services/notificationService';
definePokeBackgroundTask();

// Must be at module scope so it's active before any notification can arrive.
import * as Notifications from 'expo-notifications';
import { isExpoGo } from '@/services/notificationService';
if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data;
      if (data?.recipientId) {
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const currentUserId = await AsyncStorage.getItem('@love-tracker/sync/userId');
          if (currentUserId && data.recipientId !== currentUserId) {
            return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
          }
        } catch {
          // fallback: show
        }
      }
      return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
    },
  });
}

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
import { useEntitlementStore } from '@/store/useEntitlementStore';
import { initPurchases } from '@/services/purchases';
import { View, ActivityIndicator, AppState } from 'react-native';
import { useSocketStore } from '@/store/useSocketStore';
import {
  PokeMessage,
  registerForPushNotificationsAsync,
  registerPokeBackgroundTask,
  registerPokeCategory,
  schedulePokeNotification,
  setupNotificationListeners,
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
  const isPokeStoreHydrated = usePokeStore((s) => s.isHydrated);

  const { connect: connectSocket, disconnect: disconnectSocket } = useSocketStore();

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

  // Socket and Background/Foreground lifecycle
  useEffect(() => {
    if (!userId) {
      disconnectSocket();
      return;
    }

    // Connect immediately if we have a userId
    connectSocket();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('[_layout] App came to foreground, connecting socket and syncing...');
        connectSocket();
        sync().catch(console.error);
      } else if (nextAppState.match(/inactive|background/)) {
        console.log('[_layout] App went to background, disconnecting socket...');
        disconnectSocket();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [userId]);

  // RevenueCat SDK init + server-verified entitlement refresh (spec 003)
  useEffect(() => {
    if (!userId) return;
    initPurchases(userId);
    useEntitlementStore.getState().refresh();
  }, [userId]);

  // Register background task when the JS thread is idle — on Android the native
  // SharedPreferences context isn't ready until the first render cycle completes.
  useEffect(() => {
    const id = requestIdleCallback(() => { registerPokeBackgroundTask(); });
    return () => cancelIdleCallback(id);
  }, []);

  // Setup notification response listeners
  useEffect(() => {
    const cleanup = setupNotificationListeners();
    return cleanup;
  }, []);

  // Register push token — runs once when userId is available
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) await registerPushToken(token);
      } catch (err: any) {
        console.error('[_layout] Push token registration error:', err.message);
      }
    })();
  }, [userId]);

  // Set up persistent poke notification — waits for isPokeStoreHydrated so the
  // slots loaded from AsyncStorage (including custom pokes) are used, not DEFAULT_SLOTS.
  useEffect(() => {
    if (!userId || !isPokeStoreHydrated) return;
    const activePartner = partners.find(p => p.status === 'active');
    if (!activePartner) return;
    const getLabel = (msg: PokeMessage) => msg.customLabel ?? t(`poke.messages.${msg.key}`, { defaultValue: msg.key });
    registerPokeCategory(slots, getLabel).catch(console.error);
    schedulePokeNotification(
      { partnerId: activePartner.id, partnerName: activePartner.alias, slots },
      t('poke.notifTitle'),
      t('poke.notifBody', { name: activePartner.alias })
    ).catch(console.error);
  }, [userId, isPokeStoreHydrated, partners.length]);

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
        <Stack.Screen name="modal/ai-insights" options={{ presentation: 'modal' }} />
        <Stack.Screen name="modal/paywall" options={{ presentation: 'modal' }} />
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
