/**
 * AddMeterReadingScreen
 *
 * Month-wise meter reading entry.
 *
 * Rules:
 *   - Month selector defaults to current month.
 *   - Previous reading is auto-filled from the last recorded current reading.
 *   - Current reading must be >= previous reading (validated client + server).
 *   - Duplicate readings for the same tenant + month are prevented.
 *   - Owner can configure the per-unit rate (default ₹8/unit).
 *   - Live bill calculation preview updates as values are typed.
 *
 * Calculation:
 *   Units = Current − Previous
 *   Bill  = Units × Rate
 */
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
import { format, subMonths } from 'date-fns';

import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants';
import AuthInput from '../../components/AuthInput';
import DatePickerInput from '../../components/DatePickerInput';
import {
  getLatestReadingBeforeMonth,
  addMeterReading,
  calculateElectricityBill,
  readingExistsForMonth,
} from '../../services/electricityService';
import { getTenantById } from '../../services/tenantService';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';
import type { MeterReading, OwnerStackParamList, Tenant } from '../../types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'AddMeterReading'>;

const DEFAULT_RATE = '8';

// Build a list of the last 12 months for the month picker
function buildMonthOptions(): { label: string; value: string }[] {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    options.push({
      label: format(d, 'MMMM yyyy'),
      value: format(d, 'yyyy-MM'),
    });
  }
  return options;
}

const MONTH_OPTIONS = buildMonthOptions();

export default function AddMeterReadingScreen({ route, navigation }: Props) {
  const { tenantId } = route.params;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [lastReading, setLastReading] = useState<MeterReading | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form fields
  const [selectedMonth, setSelectedMonth] = useState(MONTH_OPTIONS[0].value); // default: current month
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [previousStr, setPreviousStr] = useState('');
  const [currentStr, setCurrentStr] = useState('');
  const [rateStr, setRateStr] = useState(DEFAULT_RATE);
  const [readingDate, setReadingDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [monthAlreadyExists, setMonthAlreadyExists] = useState(false);

  // ── Load tenant + last reading ────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      getTenantById(tenantId),
      getLatestReadingBeforeMonth(tenantId, selectedMonth),
    ])
      .then(([t, last]) => {
        setTenant(t);
        setLastReading(last);
        // Auto-fill from the last reading before the selected month.
        setPreviousStr(last ? String(last.current_reading) : '');
      })
      .catch(err => console.warn('[AddMeterReading] load error:', err))
      .finally(() => setIsLoading(false));
  }, [tenantId, selectedMonth]);

  // ── Check duplicate when month changes ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    readingExistsForMonth(tenantId, selectedMonth)
      .then(exists => {
        if (!cancelled) { setMonthAlreadyExists(exists); }
      })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [tenantId, selectedMonth]);

  // ── Live calculation ──────────────────────────────────────────────────────
  const prev = Number(previousStr) || 0;
  const curr = Number(currentStr) || 0;
  const rate = Number(rateStr) || 0;
  const { unitsConsumed, amount } = calculateElectricityBill(prev, curr, rate);
  const calcReady = currentStr !== '' && previousStr !== '';

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): boolean {
    const next: Record<string, string> = {};

    if (monthAlreadyExists) {
      next.month = `A reading for ${selectedMonth} already exists for this tenant.`;
    }
    if (!previousStr || isNaN(Number(previousStr)) || Number(previousStr) < 0) {
      next.previous = 'Enter a valid previous reading.';
    }
    if (!currentStr || isNaN(Number(currentStr)) || Number(currentStr) < 0) {
      next.current = 'Enter a valid current reading.';
    } else if (Number(currentStr) < Number(previousStr)) {
      next.current = 'Current reading cannot be less than previous reading.';
    }
    if (!rateStr || isNaN(Number(rateStr)) || Number(rateStr) <= 0) {
      next.rate = 'Enter a valid rate per unit.';
    }
    if (!readingDate || !/^\d{4}-\d{2}-\d{2}$/.test(readingDate)) {
      next.readingDate = 'Enter date as YYYY-MM-DD.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearErr(key: string) {
    if (errors[key]) {
      setErrors(p => {
        const copy = { ...p };
        delete copy[key];
        return copy;
      });
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!validate()) { return; }
    setIsSaving(true);
    try {
      await addMeterReading({
        tenantId,
        month: selectedMonth,
        previousReading: Number(previousStr),
        currentReading: Number(currentStr),
        rate: Number(rateStr),
        readingDate,
      });
      Toast.show({
        type: 'success',
        text1: 'Reading Saved',
        text2: `${tenant?.name} — ${selectedMonth} — ${unitsConsumed} units — ${formatCurrency(amount)}`,
        position: 'top',
        visibilityTime: 3500,
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', getFirebaseErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previousStr, currentStr, rateStr, readingDate, selectedMonth, tenantId, tenant, unitsConsumed, amount, navigation]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={24} color={Colors.textInverse} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Meter Reading</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const selectedMonthLabel =
    MONTH_OPTIONS.find(m => m.value === selectedMonth)?.label ?? selectedMonth;
  const initials = (tenant?.name ?? '')
    .split(' ')
    .map(w => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back">
          <Icon name="arrow-left" size={24} color={Colors.textInverse} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meter Reading</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Tenant card */}
          {tenant && (
            <View style={styles.tenantCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View>
                <Text style={styles.tenantName}>{tenant.name}</Text>
                <Text style={styles.tenantMeta}>
                  Room {tenant.room_number || '—'} · {tenant.phone}
                </Text>
              </View>
            </View>
          )}

          {/* Last reading info */}
          {lastReading && (
            <View style={styles.lastReadingBanner}>
              <Icon name="history" size={16} color={Colors.info} />
              <Text style={styles.lastReadingText}>
                Previous reading ({lastReading.month}): {lastReading.current_reading} units on {formatDate(lastReading.reading_date)}
              </Text>
            </View>
          )}

          {/* ── Month selector ────────────────────────── */}
          <Text style={styles.groupLabel}>MONTH</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.monthSelector, monthAlreadyExists && styles.monthSelectorWarning]}
              onPress={() => setShowMonthPicker(v => !v)}
              accessibilityLabel="Select month"
            >
              <View style={styles.monthSelectorLeft}>
                <Icon name="calendar-month-outline" size={20} color={monthAlreadyExists ? Colors.warning : Colors.primary} />
                <View>
                  <Text style={styles.monthSelectorLabel}>Reading Month</Text>
                  <Text style={[styles.monthSelectorValue, monthAlreadyExists && { color: Colors.warning }]}>
                    {selectedMonthLabel}
                  </Text>
                </View>
              </View>
              <Icon
                name={showMonthPicker ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={Colors.textMuted}
              />
            </TouchableOpacity>

            {/* Duplicate warning */}
            {monthAlreadyExists && (
              <View style={styles.dupWarning}>
                <Icon name="alert-outline" size={14} color={Colors.warning} />
                <Text style={styles.dupWarningText}>
                  A reading for {selectedMonthLabel} already exists. Choose a different month.
                </Text>
              </View>
            )}

            {/* Month picker dropdown */}
            {showMonthPicker && (
              <View style={styles.monthList}>
                {MONTH_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.monthOption,
                      opt.value === selectedMonth && styles.monthOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedMonth(opt.value);
                      setShowMonthPicker(false);
                      clearErr('month');
                    }}
                  >
                    <Text style={[
                      styles.monthOptionText,
                      opt.value === selectedMonth && styles.monthOptionTextSelected,
                    ]}>
                      {opt.label}
                    </Text>
                    {opt.value === selectedMonth && (
                      <Icon name="check" size={16} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* ── Reading inputs ────────────────────────── */}
          <Text style={styles.groupLabel}>METER READINGS</Text>
          <View style={styles.card}>
            <AuthInput
              label="Previous Reading (units)"
              placeholder="e.g. 12450"
              value={previousStr}
              onChangeText={v => { setPreviousStr(v); clearErr('previous'); }}
              error={errors.previous}
              keyboardType="numeric"
              returnKeyType="next"
            />
            <AuthInput
              label="Current Reading (units)"
              placeholder="e.g. 12620"
              value={currentStr}
              onChangeText={v => { setCurrentStr(v); clearErr('current'); }}
              error={errors.current}
              keyboardType="numeric"
              returnKeyType="next"
            />
            {calcReady && Number(currentStr) < Number(previousStr) && (
              <View style={styles.validationError}>
                <Icon name="alert-circle-outline" size={14} color={Colors.error} />
                <Text style={styles.validationErrorText}>
                  Current reading must be greater than or equal to previous reading.
                </Text>
              </View>
            )}
          </View>

          {/* ── Billing details ───────────────────────── */}
          <Text style={styles.groupLabel}>BILLING DETAILS</Text>
          <View style={styles.card}>
            <AuthInput
              label="Rate per Unit (₹)"
              placeholder="e.g. 8"
              value={rateStr}
              onChangeText={v => { setRateStr(v); clearErr('rate'); }}
              error={errors.rate}
              keyboardType="numeric"
              returnKeyType="next"
            />
            <DatePickerInput
              label="Reading Date"
              value={readingDate}
              onChange={v => { setReadingDate(v); clearErr('readingDate'); }}
              error={errors.readingDate}
            />
          </View>

          {/* ── Live calculation preview ──────────────── */}
          {calcReady && Number(currentStr) >= Number(previousStr) && (
            <View style={styles.calcCard}>
              <Text style={styles.calcTitle}>
                <Icon name="calculator-variant-outline" size={14} color={Colors.accent} />
                {'  '}Bill Calculation — {selectedMonthLabel}
              </Text>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Previous Reading</Text>
                <Text style={styles.calcValue}>{prev.toLocaleString('en-IN')} units</Text>
              </View>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Current Reading</Text>
                <Text style={styles.calcValue}>{curr.toLocaleString('en-IN')} units</Text>
              </View>
              <View style={styles.calcDivider} />
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Units Consumed</Text>
                <Text style={styles.calcValue}>{unitsConsumed} units</Text>
              </View>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Rate</Text>
                <Text style={styles.calcValue}>₹{rateStr || '0'}/unit</Text>
              </View>
              <View style={styles.calcDivider} />
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Electricity Bill</Text>
                <Text style={styles.calcTotal}>{formatCurrency(amount)}</Text>
              </View>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, (isSaving || monthAlreadyExists) && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={isSaving || monthAlreadyExists}
            accessibilityLabel="Save meter reading"
            accessibilityRole="button"
          >
            {isSaving ? (
              <ActivityIndicator color={Colors.textInverse} size="small" />
            ) : (
              <>
                <Icon name="lightning-bolt-outline" size={20} color={Colors.textInverse} />
                <Text style={styles.submitBtnText}>Save Reading</Text>
              </>
            )}
          </TouchableOpacity>
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
  headerTitle: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textInverse, textAlign: 'center' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  tenantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.md,
    padding: Spacing.base,
    marginBottom: Spacing.base,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.info, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textInverse },
  tenantName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textInverse },
  tenantMeta: { fontSize: FontSize.sm, color: Colors.accent, marginTop: 2 },

  lastReadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.infoLight,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: '#BEE3F8',
  },
  lastReadingText: { flex: 1, fontSize: FontSize.sm, color: Colors.info },

  groupLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
    marginTop: Spacing.base,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.base,
    ...Platform.select({
      ios: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 5 },
      android: { elevation: 2 },
    }),
  },

  // Month selector
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  monthSelectorWarning: { opacity: 0.9 },
  monthSelectorLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  monthSelectorLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  monthSelectorValue: { fontSize: FontSize.md, fontWeight: FontWeight.semiBold, color: Colors.primary },

  dupWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: Spacing.sm,
    backgroundColor: Colors.warningLight,
    padding: Spacing.sm,
    borderRadius: Radius.xs,
  },
  dupWarningText: { flex: 1, fontSize: FontSize.xs, color: Colors.warning, lineHeight: 16 },

  monthList: { marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  monthOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  monthOptionSelected: { backgroundColor: Colors.surfaceSecondary },
  monthOptionText: { fontSize: FontSize.base, color: Colors.textPrimary },
  monthOptionTextSelected: { color: Colors.primary, fontWeight: FontWeight.semiBold },

  validationError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.sm,
  },
  validationErrorText: { flex: 1, fontSize: FontSize.xs, color: Colors.error },

  // Bill calculation card
  calcCard: {
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.md,
    padding: Spacing.base,
    marginTop: Spacing.base,
  },
  calcTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: Colors.accent, marginBottom: Spacing.sm },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  calcLabel: { fontSize: FontSize.base, color: Colors.textInverse, opacity: 0.8 },
  calcValue: { fontSize: FontSize.base, fontWeight: FontWeight.medium, color: Colors.textInverse },
  calcTotal: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.accent },
  calcDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 2 },

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
  submitBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textInverse, letterSpacing: 0.3 },
});
