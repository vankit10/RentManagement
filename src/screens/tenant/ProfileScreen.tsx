import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants';
import InfoRow from '../../components/InfoRow';
import { useAuth } from '../../context/AuthContext';
import { getTenantByUserId } from '../../services/tenantService';
import { formatDate } from '../../utils/helpers';
import type { Tenant } from '../../types';

// ─── Avatar with initials ─────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(' ')
    .map(w => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');

  return (
    <View style={avatarStyles.wrap}>
      <Text style={avatarStyles.text}>{initials}</Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  wrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 5 },
    }),
  },
  text: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
});

// ─── Section card wrapper ─────────────────────────────────────────────────────
function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={sectionStyles.wrap}>
      <Text style={sectionStyles.title}>{title}</Text>
      <View style={sectionStyles.card}>{children}</View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap: { marginBottom: Spacing.base },
  title: {
    fontSize: FontSize.sm,
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
      ios: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 5,
      },
      android: { elevation: 2 },
    }),
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function TenantProfileScreen() {
  const { user, logout } = useAuth();
  const uid = user?.uid ?? '';
  const profile = user?.profile;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!uid) { return; }
    getTenantByUserId(uid)
      .then(t => {
        setTenant(t);
        setIsLoading(false);
      })
      .catch(err => {
        console.warn('[ProfileScreen] getTenant error:', err);
        setIsLoading(false);
      });
  }, [uid]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => logout(),
        },
      ],
      { cancelable: true },
    );
  }, [logout]);

  const name = profile?.name ?? 'Tenant';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Text style={styles.headerSub}>Adarsh Infra</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar + name ─────────────────────────────── */}
        <View style={styles.avatarSection}>
          <Avatar name={name} />
          <Text style={styles.name}>{name}</Text>
          <View style={styles.roleBadge}>
            <Icon name="account-outline" size={12} color={Colors.primary} />
            <Text style={styles.roleText}>Tenant</Text>
          </View>
        </View>

        {/* ── Personal info ─────────────────────────────── */}
        <SectionCard title="Personal Information">
          <InfoRow icon="account-outline" label="Full Name" value={name} />
          <View style={styles.rowDivider} />
          <InfoRow
            icon="email-outline"
            label="Email"
            value={profile?.email ?? '—'}
          />
          <View style={styles.rowDivider} />
          <InfoRow
            icon="phone-outline"
            label="Phone"
            value={profile?.phone ?? '—'}
          />
        </SectionCard>

        {/* ── Rental info ───────────────────────────────── */}
        {!isLoading && (
          <SectionCard title="Rental Information">
            <InfoRow
              icon="door-open"
              label="Room Number"
              value={tenant?.roomNumber ?? '—'}
            />
            <View style={styles.rowDivider} />
            <InfoRow
              icon="calendar-check-outline"
              label="Joining Date"
              value={formatDate(tenant?.joiningDate)}
            />
            <View style={styles.rowDivider} />
            <InfoRow
              icon="home-account"
              label="Status"
              value={
                tenant
                  ? tenant.status.charAt(0).toUpperCase() + tenant.status.slice(1)
                  : '—'
              }
              valueColor={tenant?.status === 'active' ? Colors.success : Colors.error}
            />
            {tenant?.rentAmount != null && (
              <>
                <View style={styles.rowDivider} />
                <InfoRow
                  icon="cash-multiple"
                  label="Monthly Rent"
                  value={`₹${tenant.rentAmount.toLocaleString('en-IN')}`}
                  valueColor={Colors.primary}
                />
              </>
            )}
          </SectionCard>
        )}

        {/* ── Account ───────────────────────────────────── */}
        <SectionCard title="Account">
          <InfoRow
            icon="calendar-outline"
            label="Member Since"
            value={formatDate(profile?.createdAt)}
          />
        </SectionCard>

        {/* ── Logout ────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          accessibilityLabel="Sign out"
          accessibilityRole="button"
        >
          <Icon name="logout" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          © 2026 Adarsh Infradevelopers & Construction
        </Text>
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
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textInverse },
  headerSub: { fontSize: FontSize.sm, color: Colors.accent, marginTop: 2 },

  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },

  // Avatar section
  avatarSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    marginBottom: Spacing.base,
  },
  name: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.primary,
  },

  rowDivider: { height: 1, backgroundColor: Colors.divider },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: '#F5C6C2',
  },
  logoutText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    color: Colors.error,
  },

  footer: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
