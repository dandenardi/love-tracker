/**
 * notificationService.ts (mobile)
 *
 * Handles push notification registration, category setup for the "poke"
 * feature, and the background task that intercepts action button taps.
 *
 * IMPORTANT: `definePokeBackgroundTask()` must be called at module scope
 * (top of _layout.tsx, outside any React component) so the task is
 * registered before the JS runtime is fully initialised.
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { pokeApi } from './syncApi';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const POKE_BACKGROUND_TASK = 'LOVE_TRACKER_POKE_ACTION';
export const POKE_NOTIFICATION_ID_KEY = 'poke-persistent-notification';
const POKE_CATEGORY_ID = 'POKE_CATEGORY';

// Check if we are running in Expo Go (remote push not supported since SDK 53)
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** All available poke messages — text comes from i18n keys resolved at call site */
export const POKE_MESSAGES: PokeMessage[] = [
  { key: 'thinking',  emoji: '💭' },
  { key: 'love',      emoji: '❤️' },
  { key: 'missing',   emoji: '😘' },
  { key: 'amazing',   emoji: '🔥' },
  { key: 'goodNight', emoji: '🌙' },
  { key: 'goodMorning', emoji: '☀️' },
  { key: 'hug',       emoji: '🤗' },
  { key: 'kiss',      emoji: '💋' },
  { key: 'betterDay', emoji: '⭐' },
  { key: 'proud',     emoji: '🎉' },
];

export const DEFAULT_SLOTS: [PokeMessage, PokeMessage, PokeMessage] = [
  { key: 'thinking', emoji: '💭' },
  { key: 'love',     emoji: '❤️' },
  { key: 'missing',  emoji: '😘' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PokeMessage {
  key: string;   // i18n key under poke.messages.*
  emoji: string;
}

export interface PokeNotificationContext {
  partnerId: string;
  partnerName: string;
  slots: [PokeMessage, PokeMessage, PokeMessage];
}

// ─────────────────────────────────────────────────────────────────────────────
// Background task definition (MUST be in module scope)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call this once at the top of _layout.tsx (outside any component).
 * Defines the task that handles poke button taps when the app is in background.
 */
export function definePokeBackgroundTask(): void {
  if (isExpoGo || Platform.OS === 'web') return;

  try {
    // Dynamic import to avoid side-effects in Expo Go
    const TaskManager = require('expo-task-manager');
    const Notifications = require('expo-notifications');

    // 1. Define the task
    TaskManager.defineTask(
      POKE_BACKGROUND_TASK,
      async ({ data, error }: any) => {
        if (error) {
          console.error('[PokeTask] Error in background task:', error);
          return;
        }

        try {
          const response = data;
          const actionId: string = response.actionIdentifier;

          if (
            !actionId ||
            actionId === Notifications.DEFAULT_ACTION_IDENTIFIER ||
            actionId === 'com.apple.UNNotificationDismissActionIdentifier'
          ) {
            return;
          }

          const notifData = response.notification?.request?.content?.data as {
            partnerId?: string;
            slots?: PokeMessage[];
          };

          if (!notifData?.partnerId) return;
          
          let slots = notifData.slots;
          if (!slots) {
            // If slots are missing (e.g. from a remote push), try to load them from storage
            try {
              const AsyncStorage = require('@react-native-async-storage/async-storage').default;
              const SLOTS_KEY = '@love-tracker/poke_slots';
              const raw = await AsyncStorage.getItem(SLOTS_KEY);
              if (raw) {
                slots = JSON.parse(raw);
              }
            } catch (e) {
              console.error('[PokeTask] Failed to load slots from storage:', e);
            }
          }

          if (!slots) return;

          const slot = slots.find(s => s.key === actionId);
          if (!slot) return;

          console.log('[PokeTask] Background response detected. Sending poke:', actionId, 'to partner:', notifData.partnerId);

          await pokeApi.send({
            partnerId: notifData.partnerId,
            message: actionId,
            emoji: slot.emoji,
          });

          console.log('[PokeTask] Background poke sent successfully');
        } catch (err: any) {
          console.error('[PokeTask] Failed to send background poke:', err.message);
        }
      }
    );

    // 2. IMPORTANT: Register the task with the notifications system.
    // This was missing and is critical for the task to be triggered when app is killed.
    Notifications.registerTaskAsync(POKE_BACKGROUND_TASK)
      .then(() => console.log('[Notifications] Background task registered successfully:', POKE_BACKGROUND_TASK))
      .catch((err: any) => console.error('[Notifications] Failed to register background task:', err));

  } catch (err) {
    console.error('[Notifications] Failed to define/register background task:', err);
  }
}

/**
 * Sets up the notification response listener for when the app is alive.
 */
export function setupNotificationListeners(): () => void {
  if (isExpoGo || Platform.OS === 'web') return () => {};
  
  const Notifications = require('expo-notifications');

  const subscription = Notifications.addNotificationResponseReceivedListener(async (response: any) => {
    const actionId = response.actionIdentifier;
    
    // Ignore default actions (tapping the notification itself)
    if (
      !actionId ||
      actionId === Notifications.DEFAULT_ACTION_IDENTIFIER ||
      actionId === 'com.apple.UNNotificationDismissActionIdentifier'
    ) {
      return;
    }

    const data = response.notification?.request?.content?.data;
    if (!data?.partnerId) return;

    let slots = data.slots;
    if (!slots) {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const SLOTS_KEY = '@love-tracker/poke_slots';
        const raw = await AsyncStorage.getItem(SLOTS_KEY);
        if (raw) {
          slots = JSON.parse(raw);
        }
      } catch (e) {
        console.error('[Notifications] Failed to load slots from storage in listener:', e);
      }
    }

    if (!slots) return;

    const slot = slots.find((s: PokeMessage) => s.key === actionId);
    if (!slot) return;

    try {
      console.log('[Notifications] Foreground/Background response detected. Sending poke:', actionId);
      await pokeApi.send({
        partnerId: data.partnerId,
        message: actionId,
        emoji: slot.emoji,
      });
      console.log('[Notifications] Poke sent successfully from listener');
    } catch (err: any) {
      console.error('[Notifications] Failed to send poke from listener:', err.message);
    }
  });

  return () => subscription.remove();
}

// ─────────────────────────────────────────────────────────────────────────────
// Permission + token registration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Requests push notification permission and returns the Expo push token.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (isExpoGo || Platform.OS === 'web') {
    if (isExpoGo) {
      console.warn('[Notifications] Push notifications are not supported in Expo Go.');
    }
    return null;
  }

  try {
    const Notifications = require('expo-notifications');

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('love-tracker', {
        name: 'Love Tracker',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E85D75',
        showBadge: true,
        enableVibration: true,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission not granted');
      return null;
    }

    Notifications.setNotificationHandler({
      handleNotification: async (notification: any) => {
        const data = notification.request.content.data;
        
        // If the notification is for a specific recipient and it's NOT the current user, hide it.
        // This solves the bug where users receive their own pokes when sharing a device/token.
        if (data?.recipientId) {
          try {
            // We need to check the current userId. 
            // Since we're in a service, we can't use hooks, we'll try to get it from storage.
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const currentUserId = await AsyncStorage.getItem('@love-tracker/sync/userId');
            if (currentUserId && data.recipientId !== currentUserId) {
              console.log('[Notifications] Hiding notification intended for another user:', data.recipientId);
              return {
                shouldShowBanner: false,
                shouldShowList: false,
                shouldPlaySound: false,
              };
            }
          } catch (e) {
            // Fallback: show if we can't check
          }
        }

        return {
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        };
      },
    });

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.expoConfig?.extra?.projectId ??
      Constants?.easConfig?.projectId;

    console.log('[Notifications] Using ProjectID for Token:', projectId || 'NONE (Using default)');

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    
    const token = tokenData.data;
    console.log('[Notifications] Token retrieved:', token);
    
    // Diagnostic: verify the token structure
    if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
      console.warn('[Notifications] Warning: Retrieved token does not look like an Expo Push Token.');
    }

    // Save userId to storage for notification filtering (persistent across app restarts)
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const { userId } = require('../store/useSyncStore').useSyncStore.getState();
    if (userId) {
      await AsyncStorage.setItem('@love-tracker/sync/userId', userId);
      console.log('[Notifications] Registered userId for filtering:', userId);
    }

    return token;
  } catch (err: any) {
    console.error('[Notifications] Failed to get push token:', err.message);
    if (err.message.includes('PROJECT_ID_NOT_FOUND')) {
      console.error('[Notifications] Critical: EAS Project ID is missing from Constants.');
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Poke notification category + persistent notification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registers the POKE_CATEGORY with the 3 active slots as action buttons.
 */
export async function registerPokeCategory(
  slots: [PokeMessage, PokeMessage, PokeMessage],
  getLabel: (key: string) => string
): Promise<void> {
  if (isExpoGo || Platform.OS === 'web') return;

  try {
    const Notifications = require('expo-notifications');
    const actions = slots.map(slot => ({
      identifier: slot.key,
      buttonTitle: `${slot.emoji} ${getLabel(slot.key)}`,
      options: { opensAppToForeground: false },
    }));

    await Notifications.setNotificationCategoryAsync(POKE_CATEGORY_ID, actions);
    console.log('[Notifications] Poke category registered');
  } catch (err) {
    console.error('[Notifications] Failed to register category:', err);
  }
}

/**
 * Posts (or replaces) the persistent poke notification in the tray.
 */
export async function schedulePokeNotification(
  context: PokeNotificationContext,
  titleText: string,
  bodyText: string
): Promise<void> {
  if (isExpoGo || Platform.OS === 'web') return;

  try {
    const Notifications = require('expo-notifications');
    await cancelPokeNotification();

    await Notifications.scheduleNotificationAsync({
      identifier: POKE_NOTIFICATION_ID_KEY,
      content: {
        title: titleText,
        body: bodyText,
        categoryIdentifier: POKE_CATEGORY_ID,
        data: {
          partnerId: context.partnerId,
          partnerName: context.partnerName,
          slots: context.slots,
        },
        ...(Platform.OS === 'android' && { 
          sticky: true,
          channelId: 'love-tracker',
        }),
      },
      trigger: null,
    });

    console.log('[Notifications] Poke notification scheduled');
  } catch (err) {
    console.error('[Notifications] Failed to schedule notification:', err);
  }
}

/**
 * Removes the persistent poke notification from the tray.
 */
export async function cancelPokeNotification(): Promise<void> {
  if (isExpoGo || Platform.OS === 'web') return;
  try {
    const Notifications = require('expo-notifications');
    await Notifications.dismissNotificationAsync(POKE_NOTIFICATION_ID_KEY).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(POKE_NOTIFICATION_ID_KEY).catch(() => {});
  } catch (err) {
    // ignore
  }
}
