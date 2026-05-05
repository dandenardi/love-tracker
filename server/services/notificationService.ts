/**
 * notificationService.ts
 * Sends push notifications via the Expo Push Service.
 * Does NOT throw on failure — errors are logged only so they never
 * block the primary operation (sync, poke, etc.).
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export async function sendExpoPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  // Skip tokens that are not Expo push tokens (e.g. raw FCM/APNs tokens)
  if (!expoPushToken.startsWith('ExponentPushToken[') && !expoPushToken.startsWith('ExpoPushToken[')) {
    console.warn('[Notifications] Skipping non-Expo push token:', expoPushToken.substring(0, 30));
    return;
  }

  const message: ExpoPushMessage = {
    to: expoPushToken,
    title,
    body,
    data,
    sound: 'default',
    priority: 'high',
  };

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json() as { data: ExpoPushTicket };
    const ticket = result.data;

    if (ticket.status === 'error') {
      console.error('[Notifications] Push failed:', ticket.message, ticket.details);
    } else {
      console.log('[Notifications] Push sent OK, ticket:', ticket.id);
    }
  } catch (err: any) {
    // Never propagate — notification failure must not break the caller
    console.error('[Notifications] Failed to send push notification:', err.message);
  }
}
