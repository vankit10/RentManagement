import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import {
  getTenantByUserId,
  getLatestRentRecord,
  getLatestMeterReading,
  subscribeToNotifications,
} from '../../services/tenantService';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { getSupabaseErrorMessage } from '../../utils/supabaseErrors';
import type { Tenant, RentRecord, MeterReading, AppNotification } from '../../types';

// ─── Summary card ─────────────────────────────────────────────────────────────
interface SummaryCardProps {
  icon: string;
  label: string;
  value: string;
  iconBg: string;
  iconColor: string;
}

function SummaryCard({ icon, label, value, iconBg, iconColor }: SummaryCardProps) {
  return (
    <View style={summaryStyles.card}>
      <View style={[summaryStyles.iconWrap, { backgroundColor: iconBg }]}>
        <Icon name={icon} size={22} color={iconColor} />
      </View>
      <Text style={summaryStyles.label}>{label}</Text>
      <Text style={summaryStyles.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.base,
    alignItems: 'flex-start',
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
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  value: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function TenantDashboardScreen() {
  const { user } = useAuth();
  const uid = user?.id ?? '';

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [latestRent, setLatestRent] = useState<RentRecord | null>(null);
  const [latestMeter, setLatestMeter] = useState<MeterReading | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!uid) { return; }
    setLoadError(null);
    try {
      const t = await getTenantByUserId(uid);
      setTenant(t);
      if (t) {
        const [rent, meter] = await Promise.all([
          getLatestRentRecord(t.id),
          getLatestMeterReading(t.id),
        ]);
        setLatestRent(rent);
        setLatestMeter(meter);
      }
    } catch (err) {
      console.warn('[Dashboard] loadData error:', err);
      setLoadError(getSupabaseErrorMessage(err, 'loading your dashboard'));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Real-time notification unread count ─────────────────────────────────────
  useEffect(() => {
    if (!tenant?.id) { return; }
    const unsub = subscribeToNotifications(
      tenant.id,
      (items: AppNotification[]) => {
        setUnreadCount(items.filter(n => !n.is_read).length);
      },
    );
    return unsub;
  }, [tenant?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // ── Greeting ────────────────────────────────────────────────────────────────
  const firstName = (user?.profile?.name ?? 'Tenant').split(' ')[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.name}>{firstName}</Text>
        </View>
        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
          <Icon name="bell-outline" size={24} color={Colors.textInverse} />
        </View>
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
            <Text style={styles.loadingText}>Loading your dashboard…</Text>
          </View>
        ) : (
          <>
            {/* ── Error banner ──────────────────────────────────────────────── */}
            {loadError && (
              <View style={styles.errorBanner}>
                <Icon name="alert-circle-outline" size={18} color={Colors.error} />
                <Text style={styles.errorBannerText}>{loadError}</Text>
                <TouchableOpacity onPress={() => { setIsLoading(true); loadData(); }} accessibilityLabel="Retry">
                  <Text style={styles.errorRetry}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
            {/* ── Room info strip ───────────────────────────────────────────── */}
            {tenant && (
              <View style={styles.roomStrip}>
                <Icon name="home-outline" size={16} color={Colors.accent} />
                <Text style={styles.roomText}>
                  Room {tenant.room_number}
                  {'  ·  '}
                  <Text style={styles.roomStatus}>
                    {tenant.status.charAt(0).toUpperCase() + tenant.status.slice(1)}
                  </Text>
                </Text>
              </View>
            )}

            {/* ── Summary cards ──────────────────────────────────────────────── */}
            <View style={styles.cardRow}>
              <SummaryCard
                icon="cash-multiple"
                label="Current Rent"
                value={formatCurrency(latestRent?.amount)}
                iconBg={Colors.infoLight}
                iconColor={Colors.info}
              />
              <View style={styles.cardGap} />
              <SummaryCard
                icon="lightning-bolt"
                label="Electricity Bill"
                value={formatCurrency(latestMeter?.amount)}
                iconBg="#FEF6E4"
                iconColor={Colors.warning}
              />
            </View>

            {/* ── Rent status card ───────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Rent</Text>
              {latestRent ? (
                <View style={styles.detailCard}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Amount</Text>
                    <Text style={styles.detailAmount}>
                      {formatCurrency(latestRent.amount)}
                    </Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Due Date</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(latestRent.due_date)}
                    </Text>
                  </View>
                  {latestRent.paid_date && (
                    <>
                      <View style={styles.divider} />
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Paid On</Text>
                        <Text style={styles.detailValue}>
                          {formatDate(latestRent.paid_date)}
                        </Text>
                      </View>
                    </>
                  )}
                  <View style={styles.divider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <StatusBadge status={latestRent.status} />
                  </View>
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Icon name="cash-remove" size={32} color={Colors.border} />
                  <Text style={styles.emptyText}>No rent record yet</Text>
                </View>
              )}
            </View>

            {/* ── Electricity card ───────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Latest Electricity Reading</Text>
              {latestMeter ? (
                <View style={styles.detailCard}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Current Reading</Text>
                    <Text style={styles.detailValue}>
                      {latestMeter.current_reading} units
                    </Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Previous Reading</Text>
                    <Text style={styles.detailValue}>
                      {latestMeter.previous_reading} units
                    </Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Units Consumed</Text>
                    <Text style={styles.detailValue}>
                      {latestMeter.units_consumed} units
                    </Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Rate</Text>
                    <Text style={styles.detailValue}>
                      ₹{latestMeter.rate}/unit
                    </Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Bill</Text>
                    <Text style={styles.detailAmount}>
                      {formatCurrency(latestMeter.amount)}
                    </Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Reading Date</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(latestMeter.reading_date)}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Icon name="lightning-bolt-off" size={32} color={Colors.border} />
                  <Text style={styles.emptyText}>No meter reading yet</Text>
                </View>
              )}
            </View>

            {/* ── Notification banner ───────────────────────────────────────── */}
            {unreadCount > 0 && (
              <View style={styles.notifBanner}>
                <Icon name="bell-ring-outline" size={18} color={Colors.primary} />
                <Text style={styles.notifBannerText}>
                  You have {unreadCount} unread notification
                  {unreadCount > 1 ? 's' : ''}
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
  greeting: { fontSize: FontSize.sm, color: Colors.textInverse, opacity: 0.7 },
  name: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
  headerRight: { position: 'relative', padding: Spacing.xs },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.error,
    borderRadius: Radius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 10, color: Colors.textInverse, fontWeight: FontWeight.bold },

  // Scroll
  scroll: { flex: 1 },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxl },

  // Loading
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

  // Room strip
  roomStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primaryDark,
    marginBottom: Spacing.base,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
  },
  roomText: { fontSize: FontSize.sm, color: Colors.textInverse },
  roomStatus: { color: Colors.accent },

  // Summary card row
  cardRow: { flexDirection: 'row', marginBottom: Spacing.base },
  cardGap: { width: Spacing.sm },

  // Section
  section: { marginBottom: Spacing.base },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },

  // Detail card
  detailCard: {
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
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  detailLabel: { fontSize: FontSize.base, color: Colors.textSecondary },
  detailValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  detailAmount: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  divider: { height: 1, backgroundColor: Colors.divider },

  // Empty card
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: Spacing.sm,
  },
  emptyText: { fontSize: FontSize.base, color: Colors.textMuted },

  // Notification banner
  notifBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.base,
  },
  notifBannerText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
});
