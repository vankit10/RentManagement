import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { format, addMonths, isAfter, startOfMonth } from 'date-fns';

import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants';
import AuthInput from '../../components/AuthInput';
import DatePickerInput from '../../components/DatePickerInput';
import StatusBadge from '../../components/StatusBadge';
import {
  createRentRecord,
  recordPayment,
  getRentRecordsForTenant,
  toMonthKey,
} from '../../services/rentService';
import { getReadingForMonth } from '../../services/electricityService';
import { getTenantById } from '../../services/tenantService';
import { formatCurrency, formatDate, formatMonth } from '../../utils/helpers';
import { getSupabaseErrorMessage } from '../../utils/supabaseErrors';
import { logButtonPress } from '../../utils/logger';
import type { MeterReading, OwnerStackParamList, RentRecord, Tenant } from '../../types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'RecordPayment'>;

// Allow a payment to be assigned to any month of the tenancy, not only a
// fixed recent window. A future month is kept for advance payments.
function getMonthOptions(joiningDate?: string): { label: string; value: string }[] {
  const currentMonth = startOfMonth(new Date());
  const tenancyStart = joiningDate ? startOfMonth(new Date(joiningDate)) : currentMonth;
  const firstMonth = isAfter(tenancyStart, currentMonth) ? currentMonth : tenancyStart;
  const lastMonth = addMonths(currentMonth, 1);
  const options: { label: string; value: string }[] = [];

  for (let date = firstMonth; !isAfter(date, lastMonth); date = addMonths(date, 1)) {
    options.push({
      label: format(date, 'MMMM yyyy'),
      value: format(date, 'yyyy-MM'),
    });
  }

  return options;
}

export default function RecordPaymentScreen({ route, navigation }: Props) {
  const { tenantId } = route.params;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [existingRecords, setExistingRecords] = useState<RentRecord[]>([]);
  const [meterReading, setMeterReading] = useState<MeterReading | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [selectedMonth, setSelectedMonth] = useState(toMonthKey());
  const [amountStr, setAmountStr] = useState('');
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [amountError, setAmountError] = useState('');
  const [paidDateError, setPaidDateError] = useState('');

  // ── Load tenant + existing records ────────────────────────────────────────
  useEffect(() => {
    if (!tenantId) { setIsLoading(false); return; }
    Promise.all([
      getTenantById(tenantId),
      getRentRecordsForTenant(tenantId),
    ])
      .then(([t, recs]) => {
        setTenant(t);
        setExistingRecords(recs);
        // Pre-fill amount from tenant config
        if (t?.rent_amount != null) {
          setAmountStr(String(t.rent_amount));
        }
      })
      .catch(err => {
        console.warn('[RecordPayment] load error:', err);
        setLoadError(getSupabaseErrorMessage(err, 'loading tenant details'));
      })
      .finally(() => setIsLoading(false));
  }, [tenantId]);

  // ── Find existing record for selected month ───────────────────────────────
  const existingForMonth = existingRecords.find(r => r.month === selectedMonth);
  const carriedForwardBalance = existingForMonth?.carried_forward_amount ?? 0;
  const earlierOutstandingBalance = existingRecords
    .filter(record => record.month < selectedMonth
      && (record.status === 'Pending' || record.status === 'Overdue'))
    .reduce((total, record) => total + (record.balance ?? record.amount), 0);
  const previousPendingBalance = existingForMonth
    ? carriedForwardBalance : earlierOutstandingBalance;
  const monthlyRent = existingForMonth?.base_amount ?? tenant?.rent_amount ?? 0;
  const electricityAmount = meterReading?.amount ?? 0;
  const totalPayable = existingForMonth?.amount
    ?? monthlyRent + previousPendingBalance + electricityAmount;
  const amountAlreadyPaid = existingForMonth?.amount_paid ?? 0;
  const remainingBalance = Math.max(0, totalPayable - amountAlreadyPaid);
  const enteredPayment = Number(amountStr) || 0;
  const balanceAfterPayment = Math.max(0, remainingBalance - enteredPayment);

  // ── Load the selected month's electricity bill ───────────────────────────
  useEffect(() => {
    let cancelled = false;
    getReadingForMonth(tenantId, selectedMonth)
      .then(reading => { if (!cancelled) { setMeterReading(reading); } })
      .catch(err => {
        console.warn('[RecordPayment] meter reading load error:', err);
        if (!cancelled) { setMeterReading(null); }
      });
    return () => { cancelled = true; };
  }, [tenantId, selectedMonth]);

  // A partial payment should default to the outstanding balance, never the
  // original monthly rent. This also shows a carried-forward balance clearly.
  useEffect(() => {
    setAmountStr(String(remainingBalance));
  }, [selectedMonth, remainingBalance]);

  // ── Validate ──────────────────────────────────────────────────────────────
  function validate(): boolean {
    let valid = true;

    const amount = Number(amountStr);
    if (!amountStr || isNaN(amount) || amount <= 0) {
      setAmountError('Enter a valid rent amount.');
      valid = false;
    } else {
      setAmountError('');
    }

    if (!paidDate || !/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) {
      setPaidDateError('Enter payment date as YYYY-MM-DD.');
      valid = false;
    } else {
      setPaidDateError('');
    }

    return valid;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    logButtonPress('RecordPaymentScreen', 'submit_payment', { tenantId, month: selectedMonth, amount: amountStr });
    if (!validate() || !tenant) { return; }
    setIsSaving(true);

    try {
      let rentRecordId: string;

      if (existingForMonth) {
        // Record already exists — just mark it paid
        rentRecordId = existingForMonth.id;
      } else {
        // Create a new record then mark it paid
        rentRecordId = await createRentRecord({
          tenantId,
          month: selectedMonth,
          amount: Number(amountStr),
          dueDay: tenant.due_day ?? 5,
        });
      }

      await recordPayment(rentRecordId, tenantId, Number(amountStr), paidDate);

      Toast.show({
        type: 'success',
        text1: 'Payment Recorded',
        text2: `${tenant.name} — ${formatMonth(selectedMonth + '-01')} — ${formatCurrency(Number(amountStr))}`,
        position: 'top',
        visibilityTime: 3500,
      });

      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', 'Could not record payment. Please try again.');
      console.warn('[RecordPayment] submit error:', err);
    } finally {
      setIsSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, tenantId, selectedMonth, amountStr, paidDate, existingForMonth, navigation]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={24} color={Colors.textInverse} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Record Payment</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
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
          <Text style={styles.headerTitle}>Record Payment</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={40} color={Colors.error} />
          <Text style={styles.errorTitle}>Could not load tenant</Text>
          <Text style={styles.errorMessage}>{loadError}</Text>
          <TouchableOpacity
            style={styles.errorRetryBtn}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
          >
            <Text style={styles.errorRetryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const initials = (tenant?.name ?? '')
    .split(' ').map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');
  const monthOptions = getMonthOptions(tenant?.joining_date);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-left" size={24} color={Colors.textInverse} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Record Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Tenant card ──────────────────────────── */}
          {tenant && (
            <View style={styles.tenantCard}>
              <View style={styles.tenantAvatar}>
                <Text style={styles.tenantAvatarText}>{initials}</Text>
              </View>
              <View style={styles.tenantInfo}>
                <Text style={styles.tenantName}>{tenant.name}</Text>
                <Text style={styles.tenantMeta}>
                  Room {tenant.room_number}
                  {tenant.rent_amount != null
                    ? `  ·  ₹${tenant.rent_amount.toLocaleString('en-IN')}/mo`
                    : ''}
                </Text>
              </View>
            </View>
          )}

          {/* ── Month selector ───────────────────────── */}
          <Text style={styles.groupLabel}>SELECT MONTH</Text>
          <View style={styles.monthGrid}>
            {monthOptions.map(opt => {
              const rec = existingRecords.find(r => r.month === opt.value);
              const isSelected = selectedMonth === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.monthChip,
                    isSelected && styles.monthChipActive,
                    rec?.status === 'Paid' && styles.monthChipPaid,
                  ]}
                  onPress={() => {
                    logButtonPress('RecordPaymentScreen', 'select_month', { month: opt.value });
                    setSelectedMonth(opt.value);
                  }}
                  accessibilityLabel={`Select ${opt.label}`}
                >
                  <Text
                    style={[
                      styles.monthChipText,
                      isSelected && styles.monthChipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                  {rec && (
                    <View style={styles.monthChipBadge}>
                      <StatusBadge status={rec.status} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Existing record warning */}
          {existingForMonth && existingForMonth.status === 'Paid' && (
            <View style={styles.alreadyPaidBanner}>
              <Icon name="check-circle" size={16} color={Colors.success} />
              <Text style={styles.alreadyPaidText}>
                {formatMonth(selectedMonth + '-01')} is already marked as Paid on{' '}
                {formatDate(existingForMonth.paid_date)}.
              </Text>
            </View>
          )}

          {existingForMonth && existingForMonth.status !== 'Paid' && (
            <View style={styles.existingBanner}>
              <Icon name="information-outline" size={16} color={Colors.info} />
              <Text style={styles.existingBannerText}>
                {existingForMonth.carried_forward_amount
                  ? `Includes ${formatCurrency(existingForMonth.carried_forward_amount)} carried forward from previous months. `
                  : ''}
                Outstanding balance: {formatCurrency(existingForMonth.balance ?? existingForMonth.amount)}.
                You can record a full or partial payment.
              </Text>
            </View>
          )}

          {/* ── Charges for selected month ───────────── */}
          <Text style={styles.groupLabel}>MONTHLY CHARGES</Text>
          <View style={styles.card}>
            <View style={styles.chargeRow}>
              <View style={styles.chargeIcon}>
                <Icon name="home-outline" size={18} color={Colors.primary} />
              </View>
              <View style={styles.chargeInfo}>
                <Text style={styles.chargeTitle}>Monthly Rent</Text>
                <Text style={styles.chargeMeta}>{formatMonth(selectedMonth + '-01')}</Text>
              </View>
              <Text style={styles.chargeAmount}>{formatCurrency(monthlyRent)}</Text>
            </View>
            <View style={styles.rowDivider} />
            <View style={styles.chargeRow}>
              <View style={styles.chargeIcon}>
                <Icon name="history" size={18} color={Colors.error} />
              </View>
              <View style={styles.chargeInfo}>
                <Text style={styles.chargeTitle}>Previous Pending Rent</Text>
                <Text style={styles.chargeMeta}>Unpaid rent from earlier months</Text>
              </View>
              <Text style={[styles.chargeAmount, previousPendingBalance > 0 && styles.pendingAmount]}>
                {formatCurrency(previousPendingBalance)}
              </Text>
            </View>
            <View style={styles.rowDivider} />
            <View style={styles.chargeRow}>
              <View style={styles.chargeIcon}>
                <Icon name="lightning-bolt-outline" size={18} color={Colors.warning} />
              </View>
              <View style={styles.chargeInfo}>
                <Text style={styles.chargeTitle}>Electricity Bill</Text>
                {meterReading ? (
                  <Text style={styles.chargeMeta}>
                    {meterReading.previous_reading} → {meterReading.current_reading} units · {meterReading.units_consumed} units used
                  </Text>
                ) : (
                  <Text style={styles.chargeMeta}>No meter reading saved for this month</Text>
                )}
              </View>
              <Text style={styles.chargeAmount}>
                {meterReading ? formatCurrency(electricityAmount) : '—'}
              </Text>
            </View>
            <View style={styles.rowDivider} />
            <View style={styles.totalChargeRow}>
              <Text style={styles.totalChargeLabel}>Total Payable</Text>
              <Text style={styles.totalChargeAmount}>{formatCurrency(totalPayable)}</Text>
            </View>
            <View style={styles.totalChargeRow}>
              <Text style={styles.balanceAfterLabel}>Already Paid This Month</Text>
              <Text style={styles.chargeAmount}>{formatCurrency(amountAlreadyPaid)}</Text>
            </View>
            <View style={styles.totalChargeRow}>
              <Text style={styles.balanceAfterLabel}>Remaining Balance</Text>
              <Text style={styles.balanceAfterAmount}>{formatCurrency(remainingBalance)}</Text>
            </View>
            <View style={styles.totalChargeRow}>
              <Text style={styles.balanceAfterLabel}>Pending After Payment</Text>
              <Text style={styles.balanceAfterAmount}>{formatCurrency(balanceAfterPayment)}</Text>
            </View>
          </View>

          {/* ── Payment details ──────────────────────── */}
          <Text style={styles.groupLabel}>PAYMENT DETAILS</Text>
          <View style={styles.card}>
            <AuthInput
              label="Rent Amount (₹)"
              placeholder="e.g. 8000"
              value={amountStr}
              onChangeText={v => { setAmountStr(v); if (amountError) { setAmountError(''); } }}
              error={amountError}
              keyboardType="numeric"
              returnKeyType="next"
            />
            <DatePickerInput
              label="Payment Date"
              value={paidDate}
              onChange={v => { setPaidDate(v); if (paidDateError) { setPaidDateError(''); } }}
              error={paidDateError}
            />

            {/* Summary row */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Month</Text>
                <Text style={styles.summaryValue}>
                  {formatMonth(selectedMonth + '-01')}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Amount</Text>
                <Text style={[styles.summaryValue, { color: Colors.primary }]}>
                  {amountStr ? formatCurrency(Number(amountStr)) : '—'}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Date</Text>
                <Text style={styles.summaryValue}>{formatDate(paidDate)}</Text>
              </View>
            </View>
          </View>

          {/* ── Submit button ────────────────────────── */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (isSaving || existingForMonth?.status === 'Paid') && styles.btnDisabled,
            ]}
            onPress={() => {
              logButtonPress('RecordPaymentScreen', 'submit_payment_button');
              handleSubmit();
            }}
            disabled={isSaving || existingForMonth?.status === 'Paid'}
            accessibilityLabel="Record payment"
            accessibilityRole="button"
          >
            {isSaving ? (
              <ActivityIndicator color={Colors.textInverse} size="small" />
            ) : (
              <>
                <Icon name="cash-check" size={20} color={Colors.textInverse} />
                <Text style={styles.submitBtnText}>
                  {existingForMonth?.status === 'Paid'
                    ? 'Already Paid'
                    : 'Record Payment'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* ── Rent history mini-list ───────────────── */}
          {existingRecords.length > 0 && (
            <>
              <Text style={[styles.groupLabel, { marginTop: Spacing.lg }]}>
                RECENT RENT HISTORY
              </Text>
              <View style={styles.card}>
                {existingRecords.slice(0, 6).map((rec, idx) => (
                  <React.Fragment key={rec.id}>
                    <View style={styles.histRow}>
                      <View>
                        <Text style={styles.histMonth}>
                          {formatMonth(rec.month + '-01')}
                        </Text>
                        <Text style={styles.histDate}>
                          Due {formatDate(rec.due_date)}
                          {rec.paid_date ? `  ·  Paid ${formatDate(rec.paid_date)}` : ''}
                        </Text>
                      </View>
                      <View style={styles.histRight}>
                        <Text style={styles.histInvoice}>
                          Bill {formatCurrency(rec.amount)}
                        </Text>
                        <Text style={styles.histAmount}>
                          Paid {formatCurrency(rec.amount_paid ?? 0)}
                        </Text>
                        {(rec.balance ?? 0) > 0 && (
                          <Text style={styles.histBalance}>
                            Due {formatCurrency(rec.balance ?? 0)}
                          </Text>
                        )}
                        <StatusBadge status={rec.status} />
                      </View>
                    </View>
                    {idx < Math.min(existingRecords.length, 6) - 1 && (
                      <View style={styles.rowDivider} />
                    )}
                  </React.Fragment>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },

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

  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },

  // Tenant card
  tenantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.md,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    gap: Spacing.md,
  },
  tenantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tenantAvatarText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
  tenantInfo: { flex: 1 },
  tenantName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
  tenantMeta: { fontSize: FontSize.sm, color: Colors.accent, marginTop: 2 },

  // Group label
  groupLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
    marginTop: Spacing.base,
  },

  // Month grid
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  monthChip: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  monthChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceSecondary,
  },
  monthChipPaid: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  monthChipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
  },
  monthChipTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  monthChipBadge: { marginTop: 4 },

  // Banners
  alreadyPaidBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.successLight,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: '#B7EFD0',
  },
  alreadyPaidText: { flex: 1, fontSize: FontSize.sm, color: Colors.success },
  existingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.infoLight,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: '#BEE3F8',
  },
  existingBannerText: { flex: 1, fontSize: FontSize.sm, color: Colors.info },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.base,
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

  // Selected-month charges
  chargeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  chargeIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  chargeInfo: { flex: 1 },
  chargeTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: Colors.textPrimary },
  chargeMeta: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  chargeAmount: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  pendingAmount: { color: Colors.error },
  totalChargeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.md },
  totalChargeLabel: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  totalChargeAmount: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  balanceAfterLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: Colors.textSecondary },
  balanceAfterAmount: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.error },

  // Summary row inside card
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  summaryLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 4 },
  summaryValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },

  // Submit
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    minHeight: 50,
    marginTop: Spacing.lg,
  },
  btnDisabled: { opacity: 0.5 },
  submitBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
    letterSpacing: 0.3,
  },

  // History
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  histMonth: { fontSize: FontSize.base, fontWeight: FontWeight.medium, color: Colors.textPrimary },
  histDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  histRight: { alignItems: 'flex-end', gap: 4 },
  histInvoice: { fontSize: FontSize.xs, color: Colors.textMuted },
  histAmount: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primary },
  histBalance: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold, color: Colors.error },
  rowDivider: { height: 1, backgroundColor: Colors.divider },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
