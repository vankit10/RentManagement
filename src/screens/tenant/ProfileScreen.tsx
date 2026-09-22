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
import AuthInput from '../../components/AuthInput';
import { getLatestMeterReading, getRentRecords, getTenantByUserId } from '../../services/tenantService';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { getSupabaseErrorMessage } from '../../utils/supabaseErrors';
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
  const { user, logout, updateProfile } = useAuth();
  const uid = user?.id ?? '';
  const profile = user?.profile;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingRent, setPendingRent] = useState(0);
  const [latestElectricityAmount, setLatestElectricityAmount] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');

  useEffect(() => {
    if (!uid) { return; }
    getTenantByUserId(uid)
      .then(async t => {
        setTenant(t);
        if (t) {
          const [rentRecords, latestMeter] = await Promise.all([
            getRentRecords(t.id),
            getLatestMeterReading(t.id),
          ]);
          setPendingRent(
            rentRecords
              .filter(record => record.status === 'Pending' || record.status === 'Overdue')
              .reduce((total, record) => total + Number(record.amount ?? 0), 0),
          );
          setLatestElectricityAmount(Number(latestMeter?.amount ?? 0));
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.warn('[ProfileScreen] getTenant error:', err);
        setLoadError(getSupabaseErrorMessage(err, 'loading your profile'));
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
  const totalOutstanding = pendingRent + latestElectricityAmount;

  const beginEditing = () => {
    setEditName(profile?.name ?? '');
    setEditEmail(profile?.email ?? '');
    setEditPhone(profile?.phone ?? '');
    setIsEditing(true);
  };

  const saveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Name required', 'Please enter your full name.');
      return;
    }
    setIsSaving(true);
    try {
      await updateProfile({ name: editName.trim(), email: editEmail.trim() || undefined, phone: editPhone.trim() });
      setIsEditing(false);
    } catch (err) {
      Alert.alert('Update Failed', getSupabaseErrorMessage(err, 'updating your profile'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Profile</Text>
          <Text style={styles.headerSub}>Adarsh Infra</Text>
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={beginEditing} accessibilityLabel="Edit profile">
          <Icon name="pencil-outline" size={18} color={Colors.accent} />
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
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

        {isEditing && (
          <SectionCard title="Edit Profile">
            <AuthInput label="Full Name" value={editName} onChangeText={setEditName} autoCapitalize="words" />
            <AuthInput label="Email" value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" autoCapitalize="none" />
            <AuthInput label="Phone" value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" />
            <Text style={styles.editNote}>These changes update your profile details only. Your login identifier stays the same.</Text>
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditing(false)} disabled={isSaving}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={isSaving}><Text style={styles.saveText}>{isSaving ? 'Saving…' : 'Save Changes'}</Text></TouchableOpacity>
            </View>
          </SectionCard>
        )}

        {!isLoading && tenant && (
          <View style={styles.outstandingCard}>
            <View style={styles.outstandingIcon}><Icon name="cash-clock" size={25} color={Colors.textInverse} /></View>
            <View style={styles.outstandingMain}>
              <Text style={styles.outstandingLabel}>TOTAL OUTSTANDING</Text>
              <Text style={styles.outstandingAmount}>{formatCurrency(totalOutstanding)}</Text>
              <Text style={styles.outstandingHint}>Pending rent and latest electricity bill</Text>
            </View>
            <View style={styles.outstandingBreakdown}>
              <Text style={styles.breakdownLabel}>Rent</Text><Text style={styles.breakdownValue}>{formatCurrency(pendingRent)}</Text>
              <Text style={styles.breakdownLabel}>Electricity</Text><Text style={styles.breakdownValue}>{formatCurrency(latestElectricityAmount)}</Text>
            </View>
          </View>
        )}

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
            {loadError ? (
              <View style={styles.rentalErrorRow}>
                <Icon name="alert-circle-outline" size={16} color={Colors.error} />
                <Text style={styles.rentalErrorText}>{loadError}</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (!uid) { return; }
                    setLoadError(null);
                    setIsLoading(true);
                    getTenantByUserId(uid)
                      .then(async t => {
                        setTenant(t);
                        if (t) {
                          const [rentRecords, latestMeter] = await Promise.all([
                            getRentRecords(t.id),
                            getLatestMeterReading(t.id),
                          ]);
                          setPendingRent(
                            rentRecords
                              .filter(record => record.status === 'Pending' || record.status === 'Overdue')
                              .reduce((total, record) => total + Number(record.amount ?? 0), 0),
                          );
                          setLatestElectricityAmount(Number(latestMeter?.amount ?? 0));
                        }
                        setIsLoading(false);
                      })
                      .catch(err => {
                        setLoadError(getSupabaseErrorMessage(err, 'loading your profile'));
                        setIsLoading(false);
                      });
                  }}
                  accessibilityLabel="Retry loading rental information"
                >
                  <Text style={styles.rentalRetryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <InfoRow
                  icon="door-open"
                  label="Room Number"
                  value={tenant?.room_number ?? '—'}
                />
                <View style={styles.rowDivider} />
                <InfoRow
                  icon="calendar-check-outline"
                  label="Joining Date"
                  value={formatDate(tenant?.joining_date)}
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
                {tenant?.rent_amount != null && (
                  <>
                    <View style={styles.rowDivider} />
                    <InfoRow
                      icon="cash-multiple"
                      label="Monthly Rent"
                      value={`₹${tenant.rent_amount.toLocaleString('en-IN')}`}
                      valueColor={Colors.primary}
                    />
                  </>
                )}
              </>
            )}
          </SectionCard>
        )}

        {/* ── Account ───────────────────────────────────── */}
        <SectionCard title="Account">
          <InfoRow
            icon="calendar-outline"
            label="Member Since"
            value={formatDate(profile?.created_at)}
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
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: Spacing.sm },
  editBtnText: { color: Colors.accent, fontWeight: FontWeight.semiBold, fontSize: FontSize.sm },
  outstandingCard: { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.base, marginBottom: Spacing.base, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  outstandingIcon: { width: 42, height: 42, borderRadius: Radius.full, backgroundColor: Colors.accentDark, alignItems: 'center', justifyContent: 'center' },
  outstandingMain: { flex: 1 }, outstandingLabel: { color: Colors.accent, fontSize: FontSize.xs, fontWeight: FontWeight.semiBold, letterSpacing: 0.6 }, outstandingAmount: { color: Colors.textInverse, fontSize: FontSize.xxl, fontWeight: FontWeight.bold, marginTop: 2 }, outstandingHint: { color: Colors.accent, fontSize: FontSize.xs, marginTop: 2 },
  outstandingBreakdown: { alignItems: 'flex-end' }, breakdownLabel: { color: Colors.accent, fontSize: FontSize.xs }, breakdownValue: { color: Colors.textInverse, fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, marginBottom: 3 },

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
  editNote: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: -Spacing.sm, marginBottom: Spacing.base },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, paddingBottom: Spacing.base },
  cancelBtn: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  cancelText: { color: Colors.textSecondary, fontWeight: FontWeight.medium },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  saveText: { color: Colors.textInverse, fontWeight: FontWeight.semiBold },

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

  rentalErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  rentalErrorText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.error,
    lineHeight: 18,
  },
  rentalRetryText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.error,
    textDecorationLine: 'underline',
  },
});
