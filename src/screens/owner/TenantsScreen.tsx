import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants';
import EmptyState from '../../components/EmptyState';
import { getAllTenants } from '../../services/tenantService';
import { formatDate } from '../../utils/helpers';
import { getSupabaseErrorMessage } from '../../utils/supabaseErrors';
import { logButtonPress } from '../../utils/logger';
import type { OwnerStackParamList, Tenant, TenantStatus } from '../../types';

type NavProp = NativeStackNavigationProp<OwnerStackParamList>;

type FilterStatus = 'all' | TenantStatus;

// ─── Tenant card ──────────────────────────────────────────────────────────────
function TenantCard({
  item,
  onPress,
}: {
  item: Tenant;
  onPress: (id: string) => void;
}) {
  const isActive = item.status === 'active';
  const initials = item.name
    .trim()
    .split(' ')
    .map(w => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(item.id)}
      accessibilityLabel={`View tenant ${item.name}`}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View style={[styles.avatar, !isActive && styles.avatarInactive]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.statusDot, { backgroundColor: isActive ? Colors.success : Colors.textMuted }]} />
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          <Icon name="door-open" size={12} color={Colors.textMuted} />
          {' Room '}{item.room_number}
          {'  ·  '}
          <Icon name="phone-outline" size={12} color={Colors.textMuted} />
          {' '}{item.phone}
        </Text>
        <Text style={styles.meta2}>
          Since {formatDate(item.joining_date)}
          {item.rent_amount != null ? `  ·  ₹${item.rent_amount.toLocaleString('en-IN')}/mo` : ''}
        </Text>
      </View>

      <Icon name="chevron-right" size={20} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

// ─── Filter chip ──────────────────────────────────────────────────────────────
function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[chipStyles.chip, active && chipStyles.chipActive]}
      onPress={onPress}
      accessibilityLabel={`Filter: ${label}`}
    >
      <Text style={[chipStyles.text, active && chipStyles.textActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginRight: Spacing.sm,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  text: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  textActive: { color: Colors.textInverse },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function OwnerTenantsScreen() {
  const navigation = useNavigation<NavProp>();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadTenants = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await getAllTenants();
      setTenants(data);
    } catch (err) {
      console.warn('[TenantsScreen] loadTenants error:', err);
      setLoadError(getSupabaseErrorMessage(err, 'loading tenants'));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadTenants(); }, [loadTenants]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTenants();
  }, [loadTenants]);

  // Refresh list when coming back from AddEditTenant
  useEffect(() => {
    const unsub = navigation.addListener('focus', loadTenants);
    return unsub;
  }, [navigation, loadTenants]);

  const filtered = useMemo(() => {
    let list = tenants;
    if (filter !== 'all') {
      list = list.filter(t => t.status === filter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        t =>
          t.name.toLowerCase().includes(q) ||
          t.room_number.toLowerCase().includes(q) ||
          t.phone.includes(q) ||
          (t.email ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [tenants, filter, search]);

  const handlePress = useCallback(
    (tenantId: string) => {
      logButtonPress('OwnerTenantsScreen', 'open_tenant_detail', { tenantId });
      navigation.navigate('TenantDetail', { tenantId });
    },
    [navigation],
  );

  const handleAdd = useCallback(() => {
    logButtonPress('OwnerTenantsScreen', 'add_tenant');
    navigation.navigate('AddEditTenant', {});
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Tenants</Text>
          <Text style={styles.headerSub}>
            {tenants.length} total · {tenants.filter(t => t.status === 'active').length} active
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={handleAdd}
          accessibilityLabel="Add tenant"
        >
          <Icon name="plus" size={22} color={Colors.textInverse} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Icon name="magnify" size={20} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, room, phone…"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          accessibilityLabel="Search tenants"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {(['all', 'active', 'inactive'] as FilterStatus[]).map(f => (
          <FilterChip
            key={f}
            label={f.charAt(0).toUpperCase() + f.slice(1)}
            active={filter === f}
            onPress={() => {
              logButtonPress('OwnerTenantsScreen', 'filter_tenants', { filter: f });
              setFilter(f);
            }}
          />
        ))}
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading tenants…</Text>
        </View>
      ) : loadError ? (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={40} color={Colors.error} />
          <Text style={styles.errorTitle}>Could not load tenants</Text>
          <Text style={styles.errorMessage}>{loadError}</Text>
          <TouchableOpacity
            style={styles.errorRetryBtn}
            onPress={() => {
              logButtonPress('OwnerTenantsScreen', 'retry_load_tenants');
              setIsLoading(true);
              loadTenants();
            }}
            accessibilityLabel="Retry loading tenants"
          >
            <Text style={styles.errorRetryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TenantCard item={item} onPress={handlePress} />
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
            search || filter !== 'all' ? (
              <EmptyState
                icon="account-search-outline"
                title="No tenants found"
                subtitle="Try adjusting your search or filter."
              />
            ) : (
              <EmptyState
                icon="account-plus-outline"
                title="No tenants yet"
                subtitle="Tap the + button to add your first tenant."
              />
            )
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleAdd}
        accessibilityLabel="Add new tenant"
        accessibilityRole="button"
      >
        <Icon name="plus" size={26} color={Colors.textInverse} />
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
  },
  searchIcon: { marginRight: Spacing.xs },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },

  // Filter chips
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },

  // List
  listContent: { padding: Spacing.base, paddingBottom: 80, flexGrow: 1 },
  separator: { height: Spacing.sm },

  // Tenant card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInactive: { backgroundColor: Colors.textMuted },
  avatarText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textInverse },
  info: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 3 },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.semiBold, color: Colors.textPrimary, flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  meta: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  meta2: { fontSize: FontSize.xs, color: Colors.textMuted },

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
