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
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { getTenantByUserId, getMeterReadings } from '../../services/tenantService';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { getSupabaseErrorMessage } from '../../utils/supabaseErrors';
import type { MeterReading, Tenant } from '../../types';

// ─── Meter reading row ────────────────────────────────────────────────────────
function MeterRow({ item, isLatest }: { item: MeterReading; isLatest: boolean }) {
  return (
    <View style={[rowStyles.card, isLatest && rowStyles.cardLatest]}>
      {/* Date + latest badge */}
      <View style={rowStyles.top}>
        <View style={rowStyles.dateWrap}>
          <Icon name="meter-electric-outline" size={16} color={Colors.primary} />
          <Text style={rowStyles.date}>{formatDate(item.reading_date)}</Text>
        </View>
        {isLatest && (
          <View style={rowStyles.latestBadge}>
            <Text style={rowStyles.latestText}>Latest</Text>
          </View>
        )}
      </View>

      <View style={rowStyles.divider} />

      {/* Reading pair */}
      <View style={rowStyles.readingRow}>
        <View style={rowStyles.readingItem}>
          <Text style={rowStyles.readingNum}>{item.previous_reading}</Text>
          <Text style={rowStyles.readingLabel}>Previous</Text>
        </View>
        <Icon name="arrow-right" size={18} color={Colors.textMuted} />
        <View style={rowStyles.readingItem}>
          <Text style={[rowStyles.readingNum, { color: Colors.primary }]}>
            {item.current_reading}
          </Text>
          <Text style={rowStyles.readingLabel}>Current</Text>
        </View>
      </View>

      <View style={rowStyles.divider} />

      {/* Calculation breakdown */}
      <View style={rowStyles.row}>
        <Text style={rowStyles.label}>Units Consumed</Text>
        <Text style={rowStyles.value}>{item.units_consumed} units</Text>
      </View>
      <View style={rowStyles.row}>
        <Text style={rowStyles.label}>Rate</Text>
        <Text style={rowStyles.value}>₹{item.rate}/unit</Text>
      </View>
      <View style={rowStyles.divider} />
      <View style={rowStyles.row}>
        <Text style={rowStyles.label}>Total Bill</Text>
        <Text style={rowStyles.amount}>{formatCurrency(item.amount)}</Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
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
  cardLatest: {
    borderColor: Colors.accent,
    borderWidth: 1.5,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  dateWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  date: { fontSize: FontSize.md, fontWeight: FontWeight.semiBold, color: Colors.textPrimary },
  latestBadge: {
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  latestText: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold, color: Colors.accentDark },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: Spacing.sm },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: Spacing.sm,
  },
  readingItem: { alignItems: 'center' },
  readingNum: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  readingLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  label: { fontSize: FontSize.base, color: Colors.textSecondary },
  value: { fontSize: FontSize.base, fontWeight: FontWeight.medium, color: Colors.textPrimary },
  amount: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function TenantElectricityScreen() {
  const { user } = useAuth();
  const uid = user?.id ?? '';

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [readings, setReadings] = useState<MeterReading[]>([]);
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
        const recs = await getMeterReadings(t.id);
        setReadings(recs);
      }
    } catch (err) {
      console.warn('[ElectricityScreen] loadData error:', err);
      setLoadError(getSupabaseErrorMessage(err, 'loading your electricity history'));
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

  // Total billed this year
  const totalBilled = readings.reduce((sum, r) => sum + (r.amount ?? 0), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Electricity</Text>
        <Text style={styles.headerSub}>Meter readings & bills</Text>
      </View>

      {/* Total strip */}
      {readings.length > 0 && (
        <View style={styles.totalStrip}>
          <Icon name="lightning-bolt-circle" size={20} color={Colors.accent} />
          <Text style={styles.totalLabel}>Total Billed</Text>
          <Text style={styles.totalAmount}>{formatCurrency(totalBilled)}</Text>
        </View>
      )}

      {/* List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading electricity history…</Text>
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
                accessibilityLabel="Retry loading electricity history"
              >
                <Text style={styles.errorRetry}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={readings}
            keyExtractor={item => item.id}
            renderItem={({ item, index }) => (
              <MeterRow item={item} isLatest={index === 0} />
            )}
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
                  icon="lightning-bolt-off"
                  title="No meter readings yet"
                  subtitle="Electricity readings entered by the owner will appear here."
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
  headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textInverse },
  headerSub: { fontSize: FontSize.sm, color: Colors.accent, marginTop: 2 },

  totalStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  totalLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.textInverse, opacity: 0.8 },
  totalAmount: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.accent },

  listContent: { padding: Spacing.base, paddingBottom: Spacing.xxl, flexGrow: 1 },
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
