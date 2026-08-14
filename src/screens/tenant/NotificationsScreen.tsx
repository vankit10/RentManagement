import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../context/AuthContext';
import {
  getTenantByUserId,
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../services/tenantService';
import { formatDate } from '../../utils/helpers';
import { getSupabaseErrorMessage } from '../../utils/supabaseErrors';
import type { AppNotification, NotificationType, Tenant } from '../../types';

// ─── Icon map per notification type ──────────────────────────────────────────
const TYPE_ICON: Record<NotificationType, string> = {
  rent_reminder: 'calendar-clock',
  overdue_alert: 'alert-circle-outline',
  electricity_bill: 'lightning-bolt-outline',
  payment_confirmation: 'check-circle-outline',
  general: 'bell-outline',
};

const TYPE_COLOR: Record<NotificationType, string> = {
  rent_reminder: Colors.info,
  overdue_alert: Colors.error,
  electricity_bill: Colors.warning,
  payment_confirmation: Colors.success,
  general: Colors.primary,
};

const TYPE_BG: Record<NotificationType, string> = {
  rent_reminder: Colors.infoLight,
  overdue_alert: Colors.errorLight,
  electricity_bill: Colors.warningLight,
  payment_confirmation: Colors.successLight,
  general: Colors.surfaceSecondary,
};

// ─── Notification row ──────────────────────────────────────────────────────────
function NotifRow({
  item,
  onPress,
}: {
  item: AppNotification;
  onPress: (id: string) => void;
}) {
  const icon = TYPE_ICON[item.type] ?? 'bell-outline';
  const color = TYPE_COLOR[item.type] ?? Colors.primary;
  const bg = TYPE_BG[item.type] ?? Colors.surfaceSecondary;

  return (
    <TouchableOpacity
      style={[styles.row, !item.is_read && styles.rowUnread]}
      onPress={() => onPress(item.id)}
      accessibilityLabel={`Notification: ${item.title}`}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, { backgroundColor: bg }]}>
        <Icon name={icon} size={20} color={color} />
      </View>
      <View style={styles.textWrap}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          {!item.is_read && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.message} numberOfLines={2}>
          {item.message}
        </Text>
        <Text style={styles.date}>{formatDate(item.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function TenantNotificationsScreen() {
  const { user } = useAuth();
  const uid = user?.id ?? '';

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Resolve tenant id once ──────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) { return; }
    getTenantByUserId(uid)
      .then(t => setTenant(t))
      .catch(err => {
        console.warn('[NotificationsScreen] getTenant error:', err);
        setLoadError(getSupabaseErrorMessage(err, 'loading notifications'));
        setIsLoading(false);
      });
  }, [uid]);

  // ── Real-time listener ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!tenant?.id) { return; }
    setLoadError(null);
    const unsub = subscribeToNotifications(
      tenant.id,
      items => {
        setNotifications(items);
        setIsLoading(false);
      },
      err => {
        console.warn('[NotificationsScreen] subscribe error:', err);
        setLoadError(getSupabaseErrorMessage(err, 'loading notifications'));
        setIsLoading(false);
      },
    );
    return unsub;
  }, [tenant?.id]);

  // ── Mark single as read on tap ──────────────────────────────────────────────
  const handlePress = useCallback(async (id: string) => {
    const notif = notifications.find(n => n.id === id);
    if (!notif || notif.is_read) { return; }
    try {
      await markNotificationRead(id);
    } catch (err) {
      console.warn('[NotificationsScreen] markRead error:', err);
    }
  }, [notifications]);

  // ── Mark all as read ────────────────────────────────────────────────────────
  const handleMarkAll = useCallback(async () => {
    if (!tenant?.id || markingAll) { return; }
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(tenant.id);
    } catch (err) {
      console.warn('[NotificationsScreen] markAll error:', err);
    } finally {
      setMarkingAll(false);
    }
  }, [tenant?.id, markingAll]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSub}>
              {unreadCount} unread
            </Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={handleMarkAll}
            disabled={markingAll}
            style={styles.markAllBtn}
            accessibilityLabel="Mark all as read"
          >
            <Text style={styles.markAllText}>
              {markingAll ? 'Marking…' : 'Mark all read'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading notifications…</Text>
        </View>
      ) : loadError ? (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={40} color={Colors.error} />
          <Text style={styles.errorTitle}>Could not load notifications</Text>
          <Text style={styles.errorMessage}>{loadError}</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <NotifRow item={item} onPress={handlePress} />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <EmptyState
              icon="bell-off-outline"
              title="No notifications yet"
              subtitle="Rent reminders, payment confirmations, and messages from the owner will appear here."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textInverse },
  headerSub: { fontSize: FontSize.sm, color: Colors.accent, marginTop: 2 },
  markAllBtn: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm },
  markAllText: { fontSize: FontSize.sm, color: Colors.accent, fontWeight: FontWeight.medium },

  listContent: { flexGrow: 1 },
  separator: { height: 1, backgroundColor: Colors.divider, marginLeft: 70 },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.base,
    backgroundColor: Colors.surface,
    gap: Spacing.md,
  },
  rowUnread: { backgroundColor: Colors.surfaceSecondary },

  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  textWrap: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  title: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    marginLeft: Spacing.sm,
    flexShrink: 0,
  },
  message: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  date: { fontSize: FontSize.xs, color: Colors.textMuted },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: FontSize.base, color: Colors.textMuted },

  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.sm,
  },
  errorTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
