/**
 * Notification Service — Node.js REST API
 * All Supabase calls replaced with Node.js API calls via apiClient.
 * FCM token registration still uses Firebase (device-side only).
 */
import {
  getMessaging,
  getToken,
  onMessage,
  requestPermission,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import type { RemoteMessage } from '@react-native-firebase/messaging';
import api from './apiClient';
import type { AppNotification, NotificationType } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface Paginated<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ─── FCM token ────────────────────────────────────────────────────────────────

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
 * Save FCM token to Node.js backend (POST /devices/token).
 */
export async function saveFCMToken(userId: string, token: string): Promise<void> {
  try {
    await api.post('/devices/token', {
      token,
      platform: 'ANDROID', // runtime detection can be added later
    });
  } catch (err) {
    console.warn('[notificationService] saveFCMToken error:', err);
  }
}

export function onForegroundMessage(
  callback: (message: RemoteMessage) => void,
): () => void {
  const messaging = getMessaging();
  return onMessage(messaging, callback);
}

// ─── Send notification (owner) ────────────────────────────────────────────────

export interface SendNotificationParams {
  tenantId: string;
  title: string;
  message: string;
  type: NotificationType;
}

export async function sendNotification(params: SendNotificationParams): Promise<string> {
  const notif = await api.post<{ id: string }>('/notifications', {
    tenantId: params.tenantId,
    title: params.title,
    message: params.message,
    type: mapType(params.type),
  });
  return notif.id;
}

export async function broadcastNotification(
  title: string,
  message: string,
  type: NotificationType,
  _tenantIds: string[],
): Promise<void> {
  await api.post('/notifications/broadcast', {
    title,
    message,
    type: mapType(type),
  });
}

// ─── Read notifications ───────────────────────────────────────────────────────

export async function getAllNotifications(): Promise<AppNotification[]> {
  const res = await api.get<Paginated<AppNotification>>('/notifications?limit=100');
  return (res.data ?? []).map(mapNotification);
}

export async function getNotificationsForTenant(
  _tenantId: string,
): Promise<AppNotification[]> {
  const res = await api.get<Paginated<AppNotification>>('/notifications/my?limit=100');
  return (res.data ?? []).map(mapNotification);
}

// ─── Map helpers ──────────────────────────────────────────────────────────────

// Map old Supabase type strings to new API enum values
function mapType(type: NotificationType): string {
  const map: Record<NotificationType, string> = {
    rent_reminder: 'RENT_REMINDER',
    overdue_alert: 'RENT_OVERDUE',
    electricity_bill: 'ELECTRICITY_BILL',
    payment_confirmation: 'PAYMENT_CONFIRMATION',
    general: 'GENERAL',
  };
  return map[type] ?? 'GENERAL';
}

// Map API camelCase response to local snake_case type
function mapNotification(n: AppNotification & Record<string, unknown>): AppNotification {
  return {
    id: n.id,
    tenant_id: (n.tenantId as string) ?? n.tenant_id,
    title: n.title,
    message: n.message,
    type: reverseMapType((n.type as string) ?? ''),
    is_read: (n.isRead as boolean) ?? n.is_read,
    created_at: (n.createdAt as string) ?? n.created_at,
  };
}

function reverseMapType(type: string): NotificationType {
  const map: Record<string, NotificationType> = {
    RENT_REMINDER: 'rent_reminder',
    RENT_OVERDUE: 'overdue_alert',
    ELECTRICITY_BILL: 'electricity_bill',
    PAYMENT_CONFIRMATION: 'payment_confirmation',
    GENERAL: 'general',
  };
  return map[type] ?? 'general';
}
