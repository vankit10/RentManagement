/**
 * TenantDetailScreen — Owner view
 *
 * Shows full tenant profile including:
 *   - Name, mobile number, room, joining date, rent amount, due day
 *   - Current meter reading, previous meter reading, current electricity bill
 *   - Payment history (all rent records)
 *   - Electricity history (all meter readings, month-wise)
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';

import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants';
import InfoRow from '../../components/InfoRow';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import SectionHeader from '../../components/SectionHeader';
import {
  getTenantById,
  getRentRecordsByTenant,
  getMeterReadingsByTenant,
  deactivateTenant,
} from '../../services/tenantService';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { getSupabaseErrorMessage } from '../../utils/supabaseErrors';
import { logButtonPress } from '../../utils/logger';
import type { OwnerStackParamList, Tenant, RentRecord, MeterReading } from '../../types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'TenantDetail'>;

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionButton({
  icon,
  label,
  onPress,
  color = Colors.primary,
  bg = Colors.surfaceSecondary,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
  bg?: string;
}) {
  return (
    <TouchableOpacity
      style={[actionStyles.btn, { backgroundColor: bg }]}
      onPress={onPress}
      accessibilityLabel={label}
    >
      <Icon name={icon} size={20} color={color} />
      <Text style={[actionStyles.label, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const actionStyles = StyleSheet.create({
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: 4,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    textAlign: 'center',
  },
});

function RentHistoryRow({ record }: { record: RentRecord }) {
  const monthLabel = (() => {
    try {
      return format(new Date(record.month + '-01'), 'MMMM yyyy');
    } catch {
      return record.month;
    }
  })();
  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.left}>
        <Text style={rowStyles.primary}>{monthLabel}</Text>
        <Text style={rowStyles.secondary}>Due {formatDate(record.due_date)}</Text>
      </View>
      <View style={rowStyles.right}>
        <Text style={rowStyles.amount}>{formatCurrency(record.amount)}</Text>
        <StatusBadge status={record.status} />
      </View>
    </View>
  );
}

function MeterHistoryRow({ record }: { record: MeterReading }) {
  const monthLabel = (() => {
    try {
      return format(new Date(record.month + '-01'), 'MMMM yyyy');
    } catch {
      return record.month;
    }
  })();
  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.left}>
        <Text style={rowStyles.primary}>{monthLabel}</Text>
        <Text style={rowStyles.secondary}>
          {record.previous_reading.toLocaleString('en-IN')} → {record.current_reading.toLocaleString('en-IN')} ({record.units_consumed} units @ ₹{record.rate}/unit)
        </Text>
        <Text style={rowStyles.secondary}>Reading date: {formatDate(record.reading_date)}</Text>
      </View>
      <Text style={rowStyles.amount}>{formatCurrency(record.amount)}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  left: { flex: 1 },
  right: { alignItems: 'flex-end', gap: 4 },
  primary: { fontSize: FontSize.base, fontWeight: FontWeight.medium, color: Colors.textPrimary },
  secondary: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  amount: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primary },
});

// ─── Meter summary card ────────────────────────────────────────────────────────

function MeterSummaryCard({ latest, previous }: { latest: MeterReading; previous?: MeterReading }) {
  const monthLabel = (() => {
    try { return format(new Date(latest.month + '-01'), 'MMMM yyyy'); } catch { return latest.month; }
  })();
  return (
    <View style={meterStyles.card}>
      <View style={meterStyles.headerRow}>
        <Icon name="lightning-bolt" size={18} color={Colors.accent} />
        <Text style={meterStyles.title}>Current Electricity — {monthLabel}</Text>
      </View>
      <View style={meterStyles.row}>
        <View style={meterStyles.readingBox}>
          <Text style={meterStyles.readingLabel}>Previous Reading</Text>
          <Text style={meterStyles.readingValue}>
            {latest.previous_reading.toLocaleString('en-IN')}
          </Text>
          {previous && (
            <Text style={meterStyles.readingHint}>
              (from {(() => { try { return format(new Date(previous.month + '-01'), 'MMM yyyy'); } catch { return previous.month; } })()})
            </Text>
          )}
        </View>
        <Icon name="arrow-right" size={18} color={Colors.textMuted} style={meterStyles.arrow} />
        <View style={meterStyles.readingBox}>
          <Text style={meterStyles.readingLabel}>Current Reading</Text>
          <Text style={[meterStyles.readingValue, { color: Colors.primary }]}>
            {latest.current_reading.toLocaleString('en-IN')}
          </Text>
        </View>
      </View>
      <View style={meterStyles.divider} />
      <View style={meterStyles.billRow}>
        <View>
          <Text style={meterStyles.billLabel}>Units Consumed</Text>
          <Text style={meterStyles.billValue}>{latest.units_consumed} units × ₹{latest.rate}/unit</Text>
        </View>
        <Text style={meterStyles.billAmount}>{formatCurrency(latest.amount)}</Text>
      </View>
    </View>
  );
}

const meterStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.md,
    padding: Spacing.base,
    marginBottom: Spacing.base,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: Colors.accent },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.base,
  },
  readingBox: { flex: 1, alignItems: 'center' },
  readingLabel: { fontSize: FontSize.xs, color: Colors.textInverse, opacity: 0.6, marginBottom: 4 },
  readingValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textInverse },
  readingHint: { fontSize: FontSize.xs, color: Colors.accent, marginTop: 2 },
  arrow: { marginHorizontal: Spacing.sm },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: Spacing.base },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  billLabel: { fontSize: FontSize.sm, color: Colors.textInverse, opacity: 0.7 },
  billValue: { fontSize: FontSize.xs, color: Colors.accent, marginTop: 2 },
  billAmount: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.accent },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TenantDetailScreen({ route, navigation }: Props) {
  const { tenantId } = route.params;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [rentRecords, setRentRecords] = useState<RentRecord[]>([]);
  const [meterReadings, setMeterReadings] = useState<MeterReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [t, rents, meters] = await Promise.all([
        getTenantById(tenantId),
        getRentRecordsByTenant(tenantId),
        getMeterReadingsByTenant(tenantId),
      ]);
      setTenant(t);
      setRentRecords(rents);
      setMeterReadings(meters);
    } catch (err) {
      console.warn('[TenantDetail] loadData error:', err);
      setLoadError(getSupabaseErrorMessage(err, 'loading tenant details'));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [tenantId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [navigation, loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleDeactivate = useCallback(() => {
    logButtonPress('TenantDetailScreen', 'deactivate_tenant_click', { tenantId, currentStatus: tenant?.status });
    if (!tenant) { return; }
    const isActive = tenant.status === 'active';
    Alert.alert(
      isActive ? 'Deactivate Tenant' : 'Already Inactive',
      isActive
        ? `Mark ${tenant.name} as inactive? They will no longer appear as active.`
        : 'This tenant is already inactive.',
      isActive
        ? [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Deactivate',
              style: 'destructive',
              onPress: async () => {
                logButtonPress('TenantDetailScreen', 'deactivate_tenant_confirmed', { tenantId });
                try {
                  await deactivateTenant(tenantId);
                  setTenant(prev => prev ? { ...prev, status: 'inactive' } : prev);
                } catch {
                  Alert.alert('Error', 'Could not deactivate tenant. Please try again.');
                }
              },
            },
          ]
        : [{ text: 'OK' }],
      { cancelable: true },
    );
  }, [tenant, tenantId]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={24} color={Colors.textInverse} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tenant Detail</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError && !tenant) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={24} color={Colors.textInverse} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tenant Detail</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={40} color={Colors.error} />
          <Text style={styles.errorTitle}>Could not load tenant</Text>
          <Text style={styles.errorMessage}>{loadError}</Text>
          <TouchableOpacity
            style={styles.errorRetryBtn}
            onPress={() => { setIsLoading(true); loadData(); }}
            accessibilityLabel="Retry"
          >
            <Text style={styles.errorRetryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!tenant) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={24} color={Colors.textInverse} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Not Found</Text>
          <View style={{ width: 40 }} />
        </View>
        <EmptyState icon="account-off-outline" title="Tenant not found" />
      </SafeAreaView>
    );
  }

  const isActive = tenant.status === 'active';
  const initials = tenant.name.trim().split(' ').map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');

  // Meter reading summary — latest + the one before it (for "previous reading" context)
  const latestMeter = meterReadings[0] ?? null;
  const previousMeter = meterReadings[1] ?? undefined;

  // Total rent collected
  const totalPaid = rentRecords
    .filter(r => r.status === 'Paid')
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            logButtonPress('TenantDetailScreen', 'go_back');
            navigation.goBack();
          }}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-left" size={24} color={Colors.textInverse} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{tenant.name}</Text>
        <TouchableOpacity
          onPress={() => {
            logButtonPress('TenantDetailScreen', 'edit_tenant', { tenantId });
            navigation.navigate('AddEditTenant', { tenantId });
          }}
          style={styles.editBtn}
          accessibilityLabel="Edit tenant"
        >
          <Icon name="pencil-outline" size={20} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
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
        {/* ── Avatar + status ──────────────────────── */}
        <View style={styles.heroSection}>
          <View style={[styles.avatar, !isActive && styles.avatarInactive]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{tenant.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: isActive ? Colors.successLight : Colors.errorLight }]}>
            <View style={[styles.statusDot, { backgroundColor: isActive ? Colors.success : Colors.error }]} />
            <Text style={[styles.statusText, { color: isActive ? Colors.success : Colors.error }]}>
              {isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>

        {/* ── Action buttons ──────────────────────── */}
        <View style={styles.actionRow}>
          <ActionButton
            icon="cash-plus"
            label="Record Payment"
            onPress={() => {
              logButtonPress('TenantDetailScreen', 'record_payment', { tenantId });
              navigation.navigate('RecordPayment', { tenantId });
            }}
            color={Colors.success}
            bg={Colors.successLight}
          />
          <ActionButton
            icon="meter-electric-outline"
            label="Meter Reading"
            onPress={() => {
              logButtonPress('TenantDetailScreen', 'add_meter_reading', { tenantId });
              navigation.navigate('AddMeterReading', { tenantId });
            }}
            color={Colors.info}
            bg={Colors.infoLight}
          />
          <ActionButton
            icon="bell-plus-outline"
            label="Notify"
            onPress={() => {
              logButtonPress('TenantDetailScreen', 'notify_tenant', { tenantId });
              navigation.navigate('SendNotification', { tenantId });
            }}
            color={Colors.primary}
            bg={Colors.surfaceSecondary}
          />
          <ActionButton
            icon="account-off-outline"
            label={isActive ? 'Deactivate' : 'Inactive'}
            onPress={() => {
              logButtonPress('TenantDetailScreen', 'deactivate_button');
              handleDeactivate();
            }}
            color={Colors.error}
            bg={Colors.errorLight}
          />
        </View>

        {/* ── Current electricity bill summary ─────── */}
        {latestMeter && (
          <MeterSummaryCard latest={latestMeter} previous={previousMeter} />
        )}

        {/* ── Personal info ────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PERSONAL INFORMATION</Text>
          <View style={styles.card}>
            <InfoRow icon="phone-outline" label="Mobile Number" value={tenant.phone} />
            {tenant.email ? (
              <>
                <View style={styles.divider} />
                <InfoRow icon="email-outline" label="Email" value={tenant.email} />
              </>
            ) : null}
          </View>
        </View>

        {/* ── Rental info ──────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RENTAL INFORMATION</Text>
          <View style={styles.card}>
            <InfoRow icon="door-open" label="Room Number" value={tenant.room_number || '—'} />
            <View style={styles.divider} />
            <InfoRow icon="calendar-check-outline" label="Joining Date" value={formatDate(tenant.joining_date)} />
            {tenant.rent_amount != null && tenant.rent_amount > 0 && (
              <>
                <View style={styles.divider} />
                <InfoRow
                  icon="cash-multiple"
                  label="Monthly Rent"
                  value={`₹${tenant.rent_amount.toLocaleString('en-IN')}`}
                  valueColor={Colors.primary}
                />
              </>
            )}
            {tenant.due_day != null && (
              <>
                <View style={styles.divider} />
                <InfoRow
                  icon="calendar-clock"
                  label="Due Day"
                  value={`${tenant.due_day}${ordinal(tenant.due_day)} of every month`}
                />
              </>
            )}
            {totalPaid > 0 && (
              <>
                <View style={styles.divider} />
                <InfoRow
                  icon="cash-check"
                  label="Total Collected"
                  value={formatCurrency(totalPaid)}
                  valueColor={Colors.success}
                />
              </>
            )}
          </View>
        </View>

        {/* ── Meter reading details (latest) ───────── */}
        {latestMeter && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>LATEST METER READING</Text>
            <View style={styles.card}>
              <InfoRow
                icon="calendar-month-outline"
                label="Month"
                value={(() => { try { return format(new Date(latestMeter.month + '-01'), 'MMMM yyyy'); } catch { return latestMeter.month; } })()}
              />
              <View style={styles.divider} />
              <InfoRow
                icon="counter"
                label="Previous Reading"
                value={`${latestMeter.previous_reading.toLocaleString('en-IN')} units`}
              />
              <View style={styles.divider} />
              <InfoRow
                icon="counter"
                label="Current Reading"
                value={`${latestMeter.current_reading.toLocaleString('en-IN')} units`}
                valueColor={Colors.primary}
              />
              <View style={styles.divider} />
              <InfoRow
                icon="lightning-bolt-outline"
                label="Units Consumed"
                value={`${latestMeter.units_consumed} units`}
              />
              <View style={styles.divider} />
              <InfoRow
                icon="currency-inr"
                label="Rate"
                value={`₹${latestMeter.rate}/unit`}
              />
              <View style={styles.divider} />
              <InfoRow
                icon="receipt"
                label="Electricity Bill"
                value={formatCurrency(latestMeter.amount)}
                valueColor={Colors.accent}
              />
            </View>
          </View>
        )}

        {/* ── Rent history ─────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Rent History" />
          {rentRecords.length === 0 ? (
            <View style={styles.miniEmpty}>
              <Text style={styles.miniEmptyText}>No rent records yet</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {rentRecords.map((rec, idx) => (
                <React.Fragment key={rec.id}>
                  <RentHistoryRow record={rec} />
                  {idx < rentRecords.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* ── Electricity history ───────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Electricity History" />
          {meterReadings.length === 0 ? (
            <View style={styles.miniEmpty}>
              <Text style={styles.miniEmptyText}>No meter readings yet</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {meterReadings.map((rec, idx) => (
                <React.Fragment key={rec.id}>
                  <MeterHistoryRow record={rec} />
                  {idx < meterReadings.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
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
  headerTitle: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
    textAlign: 'center',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  editBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },

  heroSection: { alignItems: 'center', paddingVertical: Spacing.xl },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Platform.select({
      ios: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8 },
      android: { elevation: 5 },
    }),
  },
  avatarInactive: { backgroundColor: Colors.textMuted },
  avatarText: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textInverse },
  name: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold },

  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.base },

  section: { marginBottom: Spacing.base },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    ...Platform.select({
      ios: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 5 },
      android: { elevation: 2 },
    }),
  },
  divider: { height: 1, backgroundColor: Colors.divider },

  miniEmpty: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  miniEmptyText: { fontSize: FontSize.base, color: Colors.textMuted },

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
