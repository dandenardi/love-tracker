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

    TaskManager.defineTask(
      POKE_BACKGROUND_TASK,
      async ({ data, error }: any) => {
        if (error) {
          console.error('[PokeTask] Error:', error);
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

          if (!notifData?.partnerId || !notifData?.slots) return;

          const slot = notifData.slots.find(s => s.key === actionId);
          if (!slot) return;

          console.log('[PokeTask] Sending poke:', actionId, 'to partner:', notifData.partnerId);

          await pokeApi.send({
            partnerId: notifData.partnerId,
            message: actionId,
            emoji: slot.emoji,
          });

          console.log('[PokeTask] Poke sent successfully');
        } catch (err: any) {
          console.error('[PokeTask] Failed to send poke:', err.message);
        }
      }
    );
  } catch (err) {
    console.error('[Notifications] Failed to define background task:', err);
  }
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
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    const tokenData = await Notifications.getExpoPushTokenAsync();
    console.log('[Notifications] Push token:', tokenData.data.substring(0, 40) + '…');
    return tokenData.data;
  } catch (err: any) {
    console.error('[Notifications] Failed to get push token:', err.message);
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
        ...(Platform.OS === 'android' && { sticky: true }),
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
