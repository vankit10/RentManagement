import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import {
  getAllRentRecords,
  detectAndMarkOverdue,
  generateCurrentMonthRent,
  recordPayment,
} from '../../services/rentService';
import { getAllTenants } from '../../services/tenantService';
import { formatCurrency, formatDate, formatMonth } from '../../utils/helpers';
import { getSupabaseErrorMessage } from '../../utils/supabaseErrors';
import { logButtonPress } from '../../utils/logger';
import type { OwnerStackParamList, RentRecord, RentStatus, Tenant } from '../../types';

type NavProp = NativeStackNavigationProp<OwnerStackParamList>;
type FilterTab = 'All' | RentStatus;

const FILTER_TABS: FilterTab[] = ['All', 'Pending', 'Overdue', 'Paid'];

// ─── Summary chip ─────────────────────────────────────────────────────────────
function SummaryChip({
  label, value, color,
}: { label: string; value: string; color: string }) {
  return (
    <View style={chipStyles.wrap}>
      <Text style={[chipStyles.value, { color }]}>{value}</Text>
      <Text style={chipStyles.label}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  wrap: { alignItems: 'center', flex: 1 },
  value: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  label: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
});

// ─── Payment row ──────────────────────────────────────────────────────────────
interface PaymentRowProps {
  record: RentRecord;
  tenantName: string;
  roomNumber: string;
  onMarkPaid: (record: RentRecord) => void;
  onNavigate: (tenantId: string) => void;
}

function PaymentRow({ record, tenantName, roomNumber, onMarkPaid, onNavigate }: PaymentRowProps) {
  const isPaid = record.status === 'Paid';
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onNavigate(record.tenant_id)}
      accessibilityLabel={`Rent record for ${tenantName}`}
      activeOpacity={0.7}
    >
      {/* Left — tenant info */}
      <View style={styles.rowLeft}>
        <View style={styles.rowAvatar}>
          <Text style={styles.rowAvatarText}>
            {tenantName.split(' ').map(w => w[0]?.toUpperCase()).slice(0, 2).join('')}
          </Text>
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.rowName} numberOfLines={1}>{tenantName}</Text>
          <Text style={styles.rowMeta}>
            Room {roomNumber}{'  ·  '}{formatMonth(record.month + '-01')}
          </Text>
          <Text style={styles.rowDate}>
            Due {formatDate(record.due_date)}
            {record.paid_date ? `  ·  Paid ${formatDate(record.paid_date)}` : ''}
          </Text>
        </View>
      </View>

      {/* Right — amount + badge + action */}
      <View style={styles.rowRight}>
        <Text style={styles.rowAmount}>{formatCurrency(record.amount)}</Text>
        <StatusBadge status={record.status} />
        {!isPaid && (
          <TouchableOpacity
            style={styles.markPaidBtn}
            onPress={() => onMarkPaid(record)}
            accessibilityLabel={`Mark ${tenantName} rent as paid`}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Icon name="check-circle-outline" size={20} color={Colors.success} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function OwnerPaymentsScreen() {
  const navigation = useNavigation<NavProp>();

  const [records, setRecords] = useState<RentRecord[]>([]);
  const [tenantMap, setTenantMap] = useState<Record<string, Tenant>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('All');
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [generatingMonth, setGeneratingMonth] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async (runOverdueCheck = false) => {
    setLoadError(null);
    try {
      if (runOverdueCheck) { await detectAndMarkOverdue(); }

      const [recs, tenants] = await Promise.all([
        getAllRentRecords(),
        getAllTenants(),
      ]);
      setRecords(recs);
      const map: Record<string, Tenant> = {};
      tenants.forEach(t => { map[t.id] = t; });
      setTenantMap(map);
    } catch (err) {
      console.warn('[PaymentsScreen] loadData error:', err);
      setLoadError(getSupabaseErrorMessage(err, 'loading payment records'));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(true); }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return records.filter(r =>
      (activeTab === 'All' || r.status === activeTab)
      && (!selectedTenantId || r.tenant_id === selectedTenantId),
    );
  }, [records, activeTab, selectedTenantId]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const collected = filtered.filter(r => r.status === 'Paid').reduce((s, r) => s + r.amount, 0);
    const pending = filtered.filter(r => r.status === 'Pending').reduce((s, r) => s + r.amount, 0);
    const overdue = filtered.filter(r => r.status === 'Overdue').reduce((s, r) => s + r.amount, 0);
    return { collected, pending, overdue };
  }, [filtered]);

  // ── Mark paid inline ───────────────────────────────────────────────────────
  const handleMarkPaid = useCallback((record: RentRecord) => {
    logButtonPress('OwnerPaymentsScreen', 'mark_paid_click', { tenantId: record.tenant_id, month: record.month });
    const tenant = tenantMap[record.tenant_id];
    const name = tenant?.name ?? 'this tenant';
    Alert.alert(
      'Mark as Paid',
      `Record ${formatMonth(record.month + '-01')} rent of ${formatCurrency(record.amount)} for ${name} as paid today?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Paid',
          onPress: async () => {
            try {
              await recordPayment(record.id);
              setRecords(prev =>
                prev.map(r =>
                  r.id === record.id
                    ? { ...r, status: 'Paid', paid_date: new Date().toISOString().slice(0, 10) }
                    : r,
                ),
              );
              Toast.show({ type: 'success', text1: 'Payment Recorded', text2: `${name} — ${formatMonth(record.month + '-01')}`, position: 'top' });
            } catch {
              Alert.alert('Error', 'Could not record payment. Please try again.');
            }
          },
        },
      ],
      { cancelable: true },
    );
  }, [tenantMap]);

  // ── Generate current month records ─────────────────────────────────────────
  const handleGenerateMonth = useCallback(async () => {
    logButtonPress('OwnerPaymentsScreen', 'generate_month_records');
    setGeneratingMonth(true);
    try {
      const count = await generateCurrentMonthRent();
      await loadData(false);
      Toast.show({
        type: 'success',
        text1: 'Month Generated',
        text2: count > 0
          ? `${count} new rent record${count > 1 ? 's' : ''} created.`
          : 'All tenants already have records for this month.',
        position: 'top',
      });
    } catch {
      Alert.alert('Error', 'Could not generate rent records. Please try again.');
    } finally {
      setGeneratingMonth(false);
    }
  }, [loadData]);

  const handleNavigate = useCallback((tenantId: string) => {
    logButtonPress('OwnerPaymentsScreen', 'open_tenant_detail', { tenantId });
    navigation.navigate('TenantDetail', { tenantId });
  }, [navigation]);

  const handleRecordPayment = useCallback((tenantId: string) => {
    logButtonPress('OwnerPaymentsScreen', 'record_payment_fab', { tenantId });
    navigation.navigate('RecordPayment', { tenantId });
  }, [navigation]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Payments</Text>
          <Text style={styles.headerSub}>{records.length} records total</Text>
        </View>
        <TouchableOpacity
          style={styles.generateBtn}
          onPress={handleGenerateMonth}
          disabled={generatingMonth}
          accessibilityLabel="Generate current month rent records"
        >
          {generatingMonth
            ? <ActivityIndicator size="small" color={Colors.textInverse} />
            : <Icon name="calendar-plus" size={20} color={Colors.textInverse} />}
        </TouchableOpacity>
      </View>

      {/* Summary strip */}
      <View style={styles.summaryStrip}>
        <SummaryChip label="Collected" value={formatCurrency(stats.collected)} color={Colors.success} />
        <View style={styles.stripDivider} />
        <SummaryChip label="Pending" value={formatCurrency(stats.pending)} color={Colors.warning} />
        <View style={styles.stripDivider} />
        <SummaryChip label="Overdue" value={formatCurrency(stats.overdue)} color={Colors.error} />
      </View>

      {/* Filter tabs */}
      <View style={styles.tabRow}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => {
              logButtonPress('OwnerPaymentsScreen', 'filter_tab', { tab });
              setActiveTab(tab);
            }}
            accessibilityLabel={`Filter ${tab}`}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
            {tab !== 'All' && (
              <View style={[
                styles.tabCount,
                activeTab === tab && styles.tabCountActive,
              ]}>
                <Text style={[styles.tabCountText, activeTab === tab && styles.tabCountTextActive]}>
                  {records.filter(r => r.status === tab).length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.tenantFilterWrap}>
        <Text style={styles.tenantFilterLabel}>FILTER BY TENANT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tenantFilterRow}>
          <TouchableOpacity style={[styles.tenantPill, !selectedTenantId && styles.tenantPillActive]} onPress={() => {
            logButtonPress('OwnerPaymentsScreen', 'tenant_filter_all');
            setSelectedTenantId(null);
          }}>
            <Text style={[styles.tenantPillText, !selectedTenantId && styles.tenantPillTextActive]}>All Tenants</Text>
          </TouchableOpacity>
          {Object.values(tenantMap).map(tenant => (
            <TouchableOpacity key={tenant.id} style={[styles.tenantPill, selectedTenantId === tenant.id && styles.tenantPillActive]} onPress={() => {
              logButtonPress('OwnerPaymentsScreen', 'tenant_filter_specific', { tenantId: tenant.id });
              setSelectedTenantId(tenant.id);
            }}>
              <Text style={[styles.tenantPillText, selectedTenantId === tenant.id && styles.tenantPillTextActive]}>{tenant.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading payments…</Text>
        </View>
      ) : loadError ? (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={40} color={Colors.error} />
          <Text style={styles.errorTitle}>Could not load payments</Text>
          <Text style={styles.errorMessage}>{loadError}</Text>
          <TouchableOpacity
            style={styles.errorRetryBtn}
            onPress={() => {
              logButtonPress('OwnerPaymentsScreen', 'retry_load_payments');
              setIsLoading(true);
              loadData(true);
            }}
            accessibilityLabel="Retry loading payments"
          >
            <Text style={styles.errorRetryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const tenant = tenantMap[item.tenant_id];
            return (
              <PaymentRow
                record={item}
                tenantName={tenant?.name ?? 'Unknown Tenant'}
                roomNumber={tenant?.room_number ?? '—'}
                onMarkPaid={handleMarkPaid}
                onNavigate={handleNavigate}
              />
            );
          }}
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
              icon="cash-remove"
              title={activeTab === 'All' ? 'No rent records yet' : `No ${activeTab} records`}
              subtitle={
                activeTab === 'All'
                  ? 'Tap the calendar icon above to generate this month\'s records.'
                  : `No rent records with status "${activeTab}" found.`
              }
            />
          }
        />
      )}

      {/* FAB — quick record payment */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => handleRecordPayment('')}
        accessibilityLabel="Record payment"
        accessibilityRole="button"
      >
        <Icon name="cash-plus" size={26} color={Colors.textInverse} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Header
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
  generateBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Summary strip
  summaryStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stripDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  tenantFilterWrap: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingTop: Spacing.sm },
  tenantFilterLabel: { marginHorizontal: Spacing.base, fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.semiBold, letterSpacing: 0.6 },
  tenantFilterRow: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, gap: Spacing.sm },
  tenantPill: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  tenantPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tenantPillText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  tenantPillTextActive: { color: Colors.textInverse, fontWeight: FontWeight.semiBold },

  // Filter tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textMuted },
  tabTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  tabCount: {
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabCountActive: { backgroundColor: Colors.primary },
  tabCountText: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.textMuted },
  tabCountTextActive: { color: Colors.textInverse },

  // List
  listContent: { flexGrow: 1, paddingBottom: 80 },
  separator: { height: 1, backgroundColor: Colors.divider },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minWidth: 0 },
  rowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowAvatarText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textInverse },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { fontSize: FontSize.base, fontWeight: FontWeight.semiBold, color: Colors.textPrimary },
  rowMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  rowDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  rowRight: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  rowAmount: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primary },
  markPaidBtn: { marginTop: 2 },

  // FAB
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
    ...Platform.select({
      ios: {
        shadowColor: Colors.accentDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
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
