import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants';
import EmptyState from '../../components/EmptyState';
import { getAllMeterReadings } from '../../services/electricityService';
import { getAllTenants } from '../../services/tenantService';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { getSupabaseErrorMessage } from '../../utils/supabaseErrors';
import type { MeterReading, OwnerStackParamList, Tenant } from '../../types';

type NavProp = NativeStackNavigationProp<OwnerStackParamList>;

// ─── Reading row ──────────────────────────────────────────────────────────────
function ReadingRow({
  record,
  tenantName,
  roomNumber,
  onPress,
}: {
  record: MeterReading;
  tenantName: string;
  roomNumber: string;
  onPress: () => void;
}) {
  const initials = tenantName.split(' ').map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`Meter reading for ${tenantName}`}
    >
      <View style={styles.rowAvatar}>
        <Text style={styles.rowAvatarText}>{initials}</Text>
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>{tenantName}</Text>
        <Text style={styles.rowMeta}>
          Room {roomNumber}{'  ·  '}{formatDate(record.reading_date)}
        </Text>
        <Text style={styles.rowReading}>
          {record.previous_reading} → {record.current_reading}
          {'  ·  '}{record.units_consumed} units @ ₹{record.rate}/unit
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowAmount}>{formatCurrency(record.amount)}</Text>
        <Icon name="chevron-right" size={16} color={Colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function OwnerElectricityScreen() {
  const navigation = useNavigation<NavProp>();

  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [tenantMap, setTenantMap] = useState<Record<string, Tenant>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [recs, tenants] = await Promise.all([
        getAllMeterReadings(),
        getAllTenants(),
      ]);
      setReadings(recs);
      const map: Record<string, Tenant> = {};
      tenants.forEach(t => { map[t.id] = t; });
      setTenantMap(map);
    } catch (err) {
      console.warn('[OwnerElectricity] loadData error:', err);
      setLoadError(getSupabaseErrorMessage(err, 'loading meter readings'));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Refresh when returning from AddMeterReading
  useEffect(() => {
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [navigation, loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const totalBilled = useMemo(
    () => readings.reduce((s, r) => s + (r.amount ?? 0), 0),
    [readings],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Electricity</Text>
          <Text style={styles.headerSub}>{readings.length} readings total</Text>
        </View>
      </View>

      {/* Total strip */}
      {readings.length > 0 && (
        <View style={styles.totalStrip}>
          <Icon name="lightning-bolt-circle" size={18} color={Colors.accent} />
          <Text style={styles.totalLabel}>Total Billed (all time)</Text>
          <Text style={styles.totalAmount}>{formatCurrency(totalBilled)}</Text>
        </View>
      )}

      {/* List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading meter readings…</Text>
        </View>
      ) : loadError ? (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={40} color={Colors.error} />
          <Text style={styles.errorTitle}>Could not load readings</Text>
          <Text style={styles.errorMessage}>{loadError}</Text>
          <TouchableOpacity
            style={styles.errorRetryBtn}
            onPress={() => { setIsLoading(true); loadData(); }}
            accessibilityLabel="Retry loading meter readings"
          >
            <Text style={styles.errorRetryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={readings}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const tenant = tenantMap[item.tenant_id];
            return (
              <ReadingRow
                record={item}
                tenantName={tenant?.name ?? 'Unknown'}
                roomNumber={tenant?.room_number ?? '—'}
                onPress={() => navigation.navigate('TenantDetail', { tenantId: item.tenant_id })}
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
              icon="meter-electric-outline"
              title="No meter readings yet"
              subtitle="Open a tenant's detail page and tap Meter Reading to add one."
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
  listContent: { flexGrow: 1 },
  separator: { height: 1, backgroundColor: Colors.divider },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  rowAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.info,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowAvatarText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textInverse },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { fontSize: FontSize.base, fontWeight: FontWeight.semiBold, color: Colors.textPrimary },
  rowMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  rowReading: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  rowAmount: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primary },
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
