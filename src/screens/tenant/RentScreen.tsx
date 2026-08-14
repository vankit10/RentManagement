import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { getTenantByUserId, getRentRecords } from '../../services/tenantService';
import { formatCurrency, formatDate, formatMonth } from '../../utils/helpers';
import { getSupabaseErrorMessage } from '../../utils/supabaseErrors';
import type { RentRecord, Tenant } from '../../types';

// ─── Rent record row ──────────────────────────────────────────────────────────
function RentRow({ item }: { item: RentRecord }) {
  return (
    <View style={rowStyles.card}>
      {/* Month + status */}
      <View style={rowStyles.top}>
        <View style={rowStyles.monthWrap}>
          <Icon name="calendar-month-outline" size={16} color={Colors.primary} />
          <Text style={rowStyles.month}>{formatMonth(item.due_date)}</Text>
        </View>
        <StatusBadge status={item.status} />
      </View>

      <View style={rowStyles.divider} />

      {/* Amount */}
      <View style={rowStyles.row}>
        <Text style={rowStyles.label}>Rent Amount</Text>
        <Text style={rowStyles.amount}>{formatCurrency(item.amount)}</Text>
      </View>

      {/* Due date */}
      <View style={rowStyles.row}>
        <Text style={rowStyles.label}>Due Date</Text>
        <Text style={rowStyles.value}>{formatDate(item.due_date)}</Text>
      </View>

      {/* Paid date — only when paid */}
      {item.paid_date && (
        <View style={rowStyles.row}>
          <Text style={rowStyles.label}>Paid On</Text>
          <Text style={[rowStyles.value, rowStyles.paidDate]}>
            {formatDate(item.paid_date)}
          </Text>
        </View>
      )}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 5,
      },
      android: { elevation: 2 },
    }),
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  monthWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  month: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  divider: { height: 1, backgroundColor: Colors.divider, marginBottom: Spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  label: { fontSize: FontSize.base, color: Colors.textSecondary },
  amount: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  value: { fontSize: FontSize.base, fontWeight: FontWeight.medium, color: Colors.textPrimary },
  paidDate: { color: Colors.success },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function TenantRentScreen() {
  const { user } = useAuth();
  const uid = user?.id ?? '';

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [records, setRecords] = useState<RentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!uid) { return; }
    setLoadError(null);
    try {
      const t = tenant ?? (await getTenantByUserId(uid));
      if (!tenant) { setTenant(t); }
      if (t) {
        const recs = await getRentRecords(t.id);
        setRecords(recs);
      }
    } catch (err) {
      console.warn('[RentScreen] loadData error:', err);
      setLoadError(getSupabaseErrorMessage(err, 'loading your rent history'));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [uid, tenant]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const paid = records.filter(r => r.status === 'Paid').length;
  const pending = records.filter(r => r.status === 'Pending').length;
  const overdue = records.filter(r => r.status === 'Overdue').length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rent History</Text>
        <Text style={styles.headerSub}>Adarsh Infra</Text>
      </View>

      {/* Stats strip */}
      {records.length > 0 && (
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: Colors.success }]}>{paid}</Text>
            <Text style={styles.statLabel}>Paid</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: Colors.warning }]}>{pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: Colors.error }]}>{overdue}</Text>
            <Text style={styles.statLabel}>Overdue</Text>
          </View>
        </View>
      )}

      {/* List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading rent history…</Text>
        </View>
      ) : (
        <>
          {/* Error banner */}
          {loadError && (
            <View style={styles.errorBanner}>
              <Icon name="alert-circle-outline" size={18} color={Colors.error} />
              <Text style={styles.errorBannerText}>{loadError}</Text>
              <TouchableOpacity
                onPress={() => { setIsLoading(true); loadData(); }}
                accessibilityLabel="Retry loading rent history"
              >
                <Text style={styles.errorRetry}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={records}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <RentRow item={item} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.accent}
                colors={[Colors.accent]}
              />
            }
            ListEmptyComponent={
              loadError ? null : (
                <EmptyState
                  icon="cash-remove"
                  title="No rent records yet"
                  subtitle="Your rent history will appear here once the owner sets up your records."
                />
              )
            }
          />
        </>
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
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
  headerSub: {
    fontSize: FontSize.sm,
    color: Colors.accent,
    marginTop: 2,
  },

  statsStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  statNum: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },

  listContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxl,
    flexGrow: 1,
  },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: FontSize.base, color: Colors.textMuted },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    margin: Spacing.base,
    marginBottom: 0,
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
