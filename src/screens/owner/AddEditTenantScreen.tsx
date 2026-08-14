/**
 * AddEditTenantScreen
 *
 * Create mode  — owner fills in Name + Phone only (minimum required).
 *                Room number, joining date, rent amount, due day are optional
 *                at registration but can be filled in here too.
 *                Creates a Firestore tenant record + phoneTenantMap entry.
 *                Sends registration SMS via Cloud Function.
 *
 * Edit mode    — full form with all fields editable except phone.
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

import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants';
import AuthInput from '../../components/AuthInput';
import DatePickerInput from '../../components/DatePickerInput';
import {
  getTenantById,
  createTenant,
  updateTenant,
} from '../../services/tenantService';
import { isValidPhone, isValidEmail } from '../../utils/helpers';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';
import type { OwnerStackParamList, Tenant } from '../../types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'AddEditTenant'>;

interface FormState {
  name: string;
  phone: string;
  roomNumber: string;
  joiningDate: string;   // YYYY-MM-DD
  rentAmount: string;
  dueDate: string;       // "1"–"28"
  // Optional password — lets tenant log in with their registered mobile number.
  // Email can additionally be used as a login identifier.
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  name?: string;
  phone?: string;
  roomNumber?: string;
  joiningDate?: string;
  rentAmount?: string;
  dueDate?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  phone: '',
  roomNumber: '',
  joiningDate: new Date().toISOString().slice(0, 10),
  rentAmount: '',
  dueDate: '5',
  email: '',
  password: '',
  confirmPassword: '',
};

export default function AddEditTenantScreen({ route, navigation }: Props) {
  const tenantId = route.params?.tenantId;
  const isEdit = !!tenantId;

  const [existingTenant, setExistingTenant] = useState<Tenant | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoadingTenant, setIsLoadingTenant] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);

  // ── Load existing tenant (edit mode) ─────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !tenantId) { return; }
    getTenantById(tenantId)
      .then(t => {
        if (!t) { return; }
        setExistingTenant(t);
        setForm({
          name: t.name,
          phone: t.phone,
          roomNumber: t.room_number ?? '',
          joiningDate:
            typeof t.joining_date === 'string'
              ? t.joining_date.slice(0, 10)
              : new Date(t.joining_date).toISOString().slice(0, 10),
          rentAmount: t.rent_amount != null ? String(t.rent_amount) : '',
          dueDate: t.due_day != null ? String(t.due_day) : '5',
          // credentials are never pre-filled in edit mode
          email: '',
          password: '',
          confirmPassword: '',
        });
      })
      .catch(err => console.warn('[AddEditTenant] load error:', err))
      .finally(() => setIsLoadingTenant(false));
  }, [isEdit, tenantId]);

  // ── Field helper ──────────────────────────────────────────────────────────
  function setField<K extends keyof FormState>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) { setErrors(prev => ({ ...prev, [key]: undefined })); }
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): boolean {
    const next: FormErrors = {};

    if (!form.name.trim()) {
      next.name = 'Full name is required.';
    } else if (form.name.trim().length < 2) {
      next.name = 'Name must be at least 2 characters.';
    }

    if (!form.phone.trim()) {
      next.phone = 'Mobile number is required.';
    } else if (!isValidPhone(form.phone)) {
      next.phone = 'Enter a valid 10-digit Indian mobile number.';
    }

    // Optional fields — only validate format if provided
    if (form.joiningDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.joiningDate)) {
      next.joiningDate = 'Enter date as YYYY-MM-DD.';
    }

    if (form.rentAmount && (isNaN(Number(form.rentAmount)) || Number(form.rentAmount) <= 0)) {
      next.rentAmount = 'Enter a valid rent amount.';
    }

    if (form.dueDate) {
      const day = Number(form.dueDate);
      if (isNaN(day) || day < 1 || day > 28) {
        next.dueDate = 'Enter a day between 1 and 28.';
      }
    }

    // Password login — password is required only when the owner chooses it;
    // email is optional because the tenant can always use their mobile number.
    const hasEmail = form.email.trim().length > 0;
    const hasPassword = form.password.length > 0;

    if (hasEmail || hasPassword) {
      if (hasEmail && !isValidEmail(form.email)) {
        next.email = 'Enter a valid email address.';
      }

      if (!hasPassword) {
        next.password = 'Enter a password.';
      } else if (form.password.length < 6) {
        next.password = 'Password must be at least 6 characters.';
      }

      if (hasPassword && form.confirmPassword !== form.password) {
        next.confirmPassword = 'Passwords do not match.';
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!validate()) { return; }
    setIsSaving(true);
    try {
      if (isEdit && tenantId && existingTenant) {
        // Edit — update editable fields only (snake_case to match service/DB)
        await updateTenant(tenantId, existingTenant.user_id, {
          name: form.name.trim(),
          room_number: form.roomNumber.trim(),
          joining_date: form.joiningDate,
          rent_amount: form.rentAmount ? Number(form.rentAmount) : undefined,
          due_day: form.dueDate ? Number(form.dueDate) : undefined,
        });
        Toast.show({
          type: 'success',
          text1: 'Tenant Updated',
          text2: `${form.name.trim()} has been updated.`,
          position: 'top',
        });
      } else {
        // Create — phone + name required; rest optional
        const hasCredentials = form.password.length > 0;
        const result = await createTenant({
          name: form.name.trim(),
          phone: form.phone.trim(),
          room_number: form.roomNumber.trim(),
          joining_date: form.joiningDate,
          rent_amount: form.rentAmount ? Number(form.rentAmount) : 0,
          due_day: form.dueDate ? Number(form.dueDate) : 5,
          email: form.email.trim() || undefined,
          password: hasCredentials ? form.password : undefined,
        });

        let toastText2 = result.smsSent
          ? 'Registration SMS sent to tenant.'
          : 'Tenant registered.';

        if (hasCredentials) {
          toastText2 = result.authAccountCreated
            ? 'Tenant registered with password login.'
            : 'Tenant registered.';
        }

        Toast.show({
          type: 'success',
          text1: 'Tenant Registered',
          text2: toastText2,
          position: 'top',
          visibilityTime: 4000,
        });
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert(
        isEdit ? 'Update Failed' : 'Registration Failed',
        getFirebaseErrorMessage(err),
      );
    } finally {
      setIsSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, isEdit, tenantId, existingTenant, navigation]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoadingTenant) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={24} color={Colors.textInverse} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading…</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.headerTitle}>
          {isEdit ? 'Edit Tenant' : 'Add Tenant'}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          style={styles.saveBtn}
          accessibilityLabel="Save"
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
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
          {/* ── Required fields notice (create only) ─── */}
          {!isEdit && (
            <View style={styles.requiredBanner}>
              <Icon name="information-outline" size={18} color={Colors.info} />
              <Text style={styles.requiredBannerText}>
                Name and mobile number are required. All other fields can be filled in later.
              </Text>
            </View>
          )}

          {/* ── Personal details ──────────────────────── */}
          <Text style={styles.groupLabel}>REQUIRED</Text>
          <View style={styles.card}>
            <AuthInput
              label="Full Name"
              placeholder="e.g. Rahul Sharma"
              value={form.name}
              onChangeText={v => setField('name', v)}
              error={errors.name}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <AuthInput
              label="Mobile Number"
              placeholder="10-digit mobile number"
              value={form.phone}
              onChangeText={v => setField('phone', v)}
              error={errors.phone}
              keyboardType="phone-pad"
              maxLength={10}
              returnKeyType="next"
              // Phone cannot be changed after registration (it's the login identifier)
              editable={!isEdit}
            />
            {isEdit && (
              <Text style={styles.phoneNote}>
                <Icon name="information-outline" size={12} color={Colors.textMuted} />
                {' '}Mobile number cannot be changed — it is used for OTP login.
              </Text>
            )}
          </View>

          {/* ── Rental details ────────────────────────── */}
          <Text style={styles.groupLabel}>RENTAL DETAILS{!isEdit && '  (OPTIONAL)'}</Text>
          <View style={styles.card}>
            <AuthInput
              label="Room Number"
              placeholder="e.g. 101, A-2"
              value={form.roomNumber}
              onChangeText={v => setField('roomNumber', v)}
              error={errors.roomNumber}
              autoCapitalize="characters"
              returnKeyType="next"
            />
            <DatePickerInput
              label="Joining Date"
              value={form.joiningDate}
              onChange={v => setField('joiningDate', v)}
              error={errors.joiningDate}
            />
          </View>

          {/* ── Rent configuration ────────────────────── */}
          <Text style={styles.groupLabel}>RENT CONFIGURATION{!isEdit && '  (OPTIONAL)'}</Text>
          <View style={styles.card}>
            <AuthInput
              label="Monthly Rent Amount (₹)"
              placeholder="e.g. 8000"
              value={form.rentAmount}
              onChangeText={v => setField('rentAmount', v)}
              error={errors.rentAmount}
              keyboardType="numeric"
              returnKeyType="next"
            />
            <AuthInput
              label="Due Day of Month (1–28)"
              placeholder="e.g. 5"
              value={form.dueDate}
              onChangeText={v => setField('dueDate', v)}
              error={errors.dueDate}
              keyboardType="numeric"
              returnKeyType="done"
              maxLength={2}
              onSubmitEditing={handleSave}
            />
            <Text style={styles.hint}>
              <Icon name="information-outline" size={12} color={Colors.textMuted} />
              {' '}Rent is due on this day every month. Use 1–28 to avoid month-end issues.
            </Text>
          </View>

          {/* ── SMS notice (create only) ─────────────── */}
          {!isEdit && (
            <View style={styles.smsBanner}>
              <Icon name="message-text-outline" size={18} color={Colors.success} />
              <Text style={styles.smsBannerText}>
                An SMS will be sent to the tenant's mobile number with instructions to open the app and login using OTP.
              </Text>
            </View>
          )}

          {/* ── Login credentials (create only, optional) ── */}
          {!isEdit && (
            <>
              <Text style={styles.groupLabel}>LOGIN CREDENTIALS  (OPTIONAL)</Text>
              <View style={styles.card}>
                <Text style={styles.credentialsHint}>
                  Set a password for password login. Leave email blank to use the registered mobile number; if you provide an email, the tenant must use that email. Leave the password blank for OTP-only login.
                </Text>
                <AuthInput
                  label="Email Address (Optional)"
                  placeholder="tenant@example.com"
                  value={form.email}
                  onChangeText={v => setField('email', v)}
                  error={errors.email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                />
                <AuthInput
                  label="Password"
                  placeholder="Minimum 6 characters"
                  value={form.password}
                  onChangeText={v => setField('password', v)}
                  error={errors.password}
                  secureTextEntry
                  returnKeyType="next"
                />
                <AuthInput
                  label="Confirm Password"
                  placeholder="Re-enter password"
                  value={form.confirmPassword}
                  onChangeText={v => setField('confirmPassword', v)}
                  error={errors.confirmPassword}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
              </View>
            </>
          )}

          {/* ── Save button ───────────────────────────── */}
          <TouchableOpacity
            style={[styles.saveFullBtn, isSaving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            accessibilityLabel={isEdit ? 'Update tenant' : 'Register tenant'}
            accessibilityRole="button"
          >
            {isSaving ? (
              <ActivityIndicator color={Colors.textInverse} size="small" />
            ) : (
              <Text style={styles.saveFullBtnText}>
                {isEdit ? 'Update Tenant' : 'Register Tenant'}
              </Text>
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
  headerTitle: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
    textAlign: 'center',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.accent },

  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },

  requiredBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.infoLight,
    borderRadius: Radius.md,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: '#BEE3F8',
  },
  requiredBannerText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.info,
    lineHeight: 20,
  },

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
    marginBottom: Spacing.xs,
    ...Platform.select({
      ios: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 5 },
      android: { elevation: 2 },
    }),
  },
  phoneNote: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.base,
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: -Spacing.sm,
    lineHeight: 18,
  },
  credentialsHint: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: Spacing.base,
  },

  smsBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.successLight,
    borderRadius: Radius.md,
    padding: Spacing.base,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: '#A7F3C0',
  },
  smsBannerText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.success,
    lineHeight: 20,
  },

  saveFullBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginTop: Spacing.lg,
  },
  btnDisabled: { opacity: 0.7 },
  saveFullBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
    letterSpacing: 0.3,
  },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
