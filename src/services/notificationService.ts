/**
 * Notification Service
 *
 * Notification records are stored in Supabase (notifications table).
 * Push delivery is done via Firebase Cloud Messaging (FCM) — the only
 * remaining Firebase service in the app.
 *
 * Architecture:
 *   Owner writes notification → Supabase notifications table
 *   Supabase DB webhook / Edge Function triggers FCM HTTP v1 API
 *   FCM delivers push to tenant device
 *
 * FCM device tokens are stored in device_tokens table (Supabase).
 */
import {
  getMessaging,
  getToken,
  onMessage,
  requestPermission,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import type { RemoteMessage } from '@react-native-firebase/messaging';
import { supabase } from './supabase';
import type { AppNotification, NotificationType } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// FCM token (push notifications — Firebase Messaging only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Request FCM permission and return the device token.
 * Returns null if permission is denied.
 */
export async function requestFCMPermissionAndGetToken(): Promise<string | null> {
  try {
    const messaging = getMessaging();
    const authStatus = await requestPermission(messaging);
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;
    if (!enabled) { return null; }
    return await getToken(messaging);
  } catch (err) {
    console.warn('[notificationService] FCM token error:', err);
    return null;
  }
}

/**
 * Save the FCM device token to the device_tokens table in Supabase.
 * Uses upsert so re-logins on the same device just update the row.
 */
export async function saveFCMToken(userId: string, token: string): Promise<void> {
  const { error } = await supabase.from('device_tokens').upsert(
    {
      user_id: userId,
      token,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) {
    console.warn('[notificationService] saveFCMToken error:', error.message);
  }
}

/**
 * Listen for foreground FCM messages.
 * Returns an unsubscribe function (mirrors the old Firestore API).
 */
export function onForegroundMessage(
  callback: (message: RemoteMessage) => void,
): () => void {
  const messaging = getMessaging();
  return onMessage(messaging, callback);
}

// ─────────────────────────────────────────────────────────────────────────────
// Send notification (owner → tenant)
// ─────────────────────────────────────────────────────────────────────────────

export interface SendNotificationParams {
  tenantId: string;
  title: string;
  message: string;
  type: NotificationType;
}

/**
 * Write an in-app notification to the Supabase notifications table.
 * The push delivery is triggered server-side (Edge Function or DB webhook)
 * when this row is inserted.
 */
export async function sendNotification(
  params: SendNotificationParams,
): Promise<string> {
  const { tenantId, title, message, type } = params;

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      tenant_id: tenantId,
      title,
      message,
      type,
      is_read: false,
    })
    .select('id')
    .single();

  if (error) { throw error; }
  return (data as { id: string }).id;
}

/**
 * Send the same notification to multiple tenants at once.
 */
export async function broadcastNotification(
  title: string,
  message: string,
  type: NotificationType,
  tenantIds: string[],
): Promise<void> {
  await Promise.all(
    tenantIds.map(tenantId =>
      sendNotification({ tenantId, title, message, type }),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Read (owner view)
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { throw error; }
  return (data ?? []) as AppNotification[];
}

export async function getNotificationsForTenant(
  tenantId: string,
): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) { throw error; }
  return (data ?? []) as AppNotification[];
}
