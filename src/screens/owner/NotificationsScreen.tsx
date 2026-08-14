import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants';
import EmptyState from '../../components/EmptyState';
import { getAllNotifications } from '../../services/notificationService';
import { getAllTenants } from '../../services/tenantService';
import { formatDate } from '../../utils/helpers';
import { getSupabaseErrorMessage } from '../../utils/supabaseErrors';
import type { AppNotification, NotificationType, OwnerStackParamList, Tenant } from '../../types';

type NavProp = NativeStackNavigationProp<OwnerStackParamList>;

// ─── Type meta ────────────────────────────────────────────────────────────────
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
const TYPE_LABEL: Record<NotificationType, string> = {
  rent_reminder: 'Rent Reminder',
  overdue_alert: 'Overdue Alert',
  electricity_bill: 'Electricity Bill',
  payment_confirmation: 'Payment Confirmation',
  general: 'General',
};

// ─── Notification row ─────────────────────────────────────────────────────────
function NotifRow({
  item,
  tenantName,
  onPress,
}: {
  item: AppNotification;
  tenantName: string;
  onPress: () => void;
}) {
  const icon = TYPE_ICON[item.type] ?? 'bell-outline';
  const color = TYPE_COLOR[item.type] ?? Colors.primary;
  const bg = TYPE_BG[item.type] ?? Colors.surfaceSecondary;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`Notification to ${tenantName}: ${item.title}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: bg }]}>
        <Icon name={icon} size={20} color={color} />
      </View>
      <View style={styles.rowInfo}>
        <View style={styles.rowTitleRow}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
          <View style={[styles.typeBadge, { backgroundColor: bg }]}>
            <Text style={[styles.typeBadgeText, { color }]}>
              {TYPE_LABEL[item.type] ?? 'General'}
            </Text>
          </View>
        </View>
        <Text style={styles.rowMessage} numberOfLines={2}>{item.message}</Text>
        <Text style={styles.rowMeta}>
          To: {tenantName}{'  ·  '}{formatDate(item.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function OwnerNotificationsScreen() {
  const navigation = useNavigation<NavProp>();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [tenantMap, setTenantMap] = useState<Record<string, Tenant>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [notifs, tenants] = await Promise.all([
        getAllNotifications(),
        getAllTenants(),
      ]);
      setNotifications(notifs);
      const map: Record<string, Tenant> = {};
      tenants.forEach(t => { map[t.id] = t; });
      setTenantMap(map);
    } catch (err) {
      console.warn('[OwnerNotifications] loadData error:', err);
      setLoadError(getSupabaseErrorMessage(err, 'loading notifications'));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [navigation, loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSub}>{notifications.length} sent total</Text>
        </View>
        <TouchableOpacity
          style={styles.composeBtn}
          onPress={() => navigation.navigate('SendNotification', {})}
          accessibilityLabel="Send new notification"
        >
          <Icon name="send-outline" size={20} color={Colors.textInverse} />
        </TouchableOpacity>
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
          <TouchableOpacity
            style={styles.errorRetryBtn}
            onPress={() => { setIsLoading(true); loadData(); }}
            accessibilityLabel="Retry loading notifications"
          >
            <Text style={styles.errorRetryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <NotifRow
              item={item}
              tenantName={tenantMap[item.tenantId]?.name ?? 'Unknown Tenant'}
              onPress={() => navigation.navigate('TenantDetail', { tenantId: item.tenantId })}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="bell-off-outline"
              title="No notifications sent yet"
              subtitle="Tap the send icon above to notify a tenant."
            />
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('SendNotification', {})}
        accessibilityLabel="Compose notification"
      >
        <Icon name="bell-plus-outline" size={26} color={Colors.textInverse} />
      </TouchableOpacity>
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
  composeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { flexGrow: 1 },
  separator: { height: 1, backgroundColor: Colors.divider },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  rowTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semiBold, color: Colors.textPrimary, flex: 1, marginRight: Spacing.sm },
  typeBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, flexShrink: 0 },
  typeBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
  rowMessage: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18, marginBottom: 4 },
  rowMeta: { fontSize: FontSize.xs, color: Colors.textMuted },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
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
    marginBottom: Spacing.sm,
  },
  errorRetryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
  },
  errorRetryBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semiBold,
    color: Colors.textInverse,
  },
});
