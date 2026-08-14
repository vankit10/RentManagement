import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { getDashboardStats } from '../../services/tenantService';
import { formatCurrency, formatDate, formatMonth } from '../../utils/helpers';
import { getSupabaseErrorMessage } from '../../utils/supabaseErrors';
import type { DashboardStats } from '../../services/tenantService';

// ─── Stat card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  iconBg: string;
  iconColor: string;
  fullWidth?: boolean;
}

function StatCard({ icon, label, value, iconBg, iconColor, fullWidth }: StatCardProps) {
  return (
    <View style={[statStyles.card, fullWidth && statStyles.cardFull]}>
      <View style={[statStyles.iconWrap, { backgroundColor: iconBg }]}>
        <Icon name={icon} size={22} color={iconColor} />
      </View>
      <Text style={statStyles.label}>{label}</Text>
      <Text style={statStyles.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.base,
    ...Platform.select({
      ios: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  cardFull: { flex: undefined, marginHorizontal: 0 },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  label: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 2 },
  value: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
});

// ─── Recent payment row ───────────────────────────────────────────────────────
function PaymentRow({ record }: { record: { tenantId: string; month: string; amount: number; paidDate?: string | Date | null; status: import('../../types').RentStatus; tenantName?: string } }) {
  return (
    <View style={payStyles.row}>
      <View style={payStyles.iconWrap}>
        <Icon name="check-circle" size={18} color={Colors.success} />
      </View>
      <View style={payStyles.info}>
        <Text style={payStyles.month}>{record.tenantName || 'Unknown Tenant'}</Text>
        <Text style={payStyles.date}>{formatMonth(record.month + '-01')} • {formatDate(record.paidDate)}</Text>
      </View>
      <View style={payStyles.right}>
        <Text style={payStyles.amount}>{formatCurrency(record.amount)}</Text>
        <StatusBadge status={record.status} />
      </View>
    </View>
  );
}

const payStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  month: { fontSize: FontSize.base, fontWeight: FontWeight.medium, color: Colors.textPrimary },
  date: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primary },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function OwnerDashboardScreen() {
  const { logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err) {
      console.warn('[OwnerDashboard] loadStats error:', err);
      setLoadError(getSupabaseErrorMessage(err, 'loading the dashboard'));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadStats();
  }, [loadStats]);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ],
      { cancelable: true },
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Owner Dashboard</Text>
          <Text style={styles.headerSub}>Adarsh Infradevelopers</Text>
        </View>
        <TouchableOpacity
          onPress={handleLogout}
          style={styles.logoutBtn}
          accessibilityLabel="Sign out"
        >
          <Icon name="logout" size={20} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading dashboard…</Text>
          </View>
        ) : (
          <>
            {/* ── Error banner ─────────────────────────── */}
            {loadError && (
              <View style={styles.errorBanner}>
                <Icon name="alert-circle-outline" size={18} color={Colors.error} />
                <Text style={styles.errorBannerText}>{loadError}</Text>
                <TouchableOpacity
                  onPress={() => { setIsLoading(true); loadStats(); }}
                  accessibilityLabel="Retry loading dashboard"
                >
                  <Text style={styles.errorRetry}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
            {/* ── Tenant count row ────────────────────────── */}
            <View style={styles.row}>
              <StatCard
                icon="account-group-outline"
                label="Total Tenants"
                value={String(stats?.totalTenants ?? 0)}
                iconBg={Colors.infoLight}
                iconColor={Colors.info}
              />
              <View style={styles.gap} />
              <StatCard
                icon="account-check-outline"
                label="Active Tenants"
                value={String(stats?.activeTenants ?? 0)}
                iconBg={Colors.successLight}
                iconColor={Colors.success}
              />
            </View>

            {/* ── Rent summary row ────────────────────────── */}
            <View style={[styles.row, styles.rowMt]}>
              <StatCard
                icon="cash-check"
                label="Rent Collected"
                value={formatCurrency(stats?.rentCollected)}
                iconBg={Colors.successLight}
                iconColor={Colors.success}
              />
              <View style={styles.gap} />
              <StatCard
                icon="clock-outline"
                label="Rent Pending"
                value={formatCurrency(stats?.rentPending)}
                iconBg={Colors.warningLight}
                iconColor={Colors.warning}
              />
            </View>

            {/* ── Overdue full-width ───────────────────────── */}
            {(stats?.rentOverdue ?? 0) > 0 && (
              <View style={styles.rowMt}>
                <View style={styles.overdueCard}>
                  <View style={styles.overdueLeft}>
                    <View style={[statStyles.iconWrap, { backgroundColor: Colors.errorLight, marginBottom: 0 }]}>
                      <Icon name="alert-circle-outline" size={22} color={Colors.error} />
                    </View>
                    <View>
                      <Text style={styles.overdueLabel}>Overdue Rent</Text>
                      <Text style={styles.overdueHint}>Requires immediate attention</Text>
                    </View>
                  </View>
                  <Text style={styles.overdueAmount}>
                    {formatCurrency(stats?.rentOverdue)}
                  </Text>
                </View>
              </View>
            )}

            {/* ── Recent payments ──────────────────────────── */}
            {(stats?.recentPayments?.length ?? 0) > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Payments</Text>
                <View style={styles.sectionCard}>
                  {stats!.recentPayments.map((rec, idx) => (
                    <React.Fragment key={rec.id}>
                      <PaymentRow record={rec} />
                      {idx < stats!.recentPayments.length - 1 && (
                        <View style={styles.divider} />
                      )}
                    </React.Fragment>
                  ))}
                </View>
              </View>
            )}

            {/* ── Empty state ──────────────────────────────── */}
            {stats?.totalTenants === 0 && (
              <View style={styles.emptySection}>
                <Icon name="account-plus-outline" size={48} color={Colors.border} />
                <Text style={styles.emptyTitle}>No tenants yet</Text>
                <Text style={styles.emptySubtitle}>
                  Go to the Tenants tab to add your first tenant.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  logoutBtn: { padding: Spacing.xs },

  scroll: { flex: 1 },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxl },

  row: { flexDirection: 'row' },
  rowMt: { marginTop: Spacing.sm },
  gap: { width: Spacing.sm },

  overdueCard: {
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.md,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F5C6C2',
    gap: Spacing.sm,
  },
  overdueLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  overdueLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semiBold, color: Colors.error },
  overdueHint: { fontSize: FontSize.xs, color: Colors.error, opacity: 0.7, marginTop: 2 },
  overdueAmount: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.error },

  section: { marginTop: Spacing.lg },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    ...Platform.select({
      ios: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  divider: { height: 1, backgroundColor: Colors.divider },

  emptySection: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.sm,
  },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semiBold, color: Colors.textMuted },
  emptySubtitle: { fontSize: FontSize.base, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },

  loadingContainer: { paddingTop: Spacing.xxxl, alignItems: 'center' },
  loadingText: { fontSize: FontSize.base, color: Colors.textMuted },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.base,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: '#F5C6C2',
  },
  errorBannerText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.error,
    lineHeight: 18,
  },
  errorRetry: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.error,
    textDecorationLine: 'underline',
  },
});
