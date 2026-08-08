import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants';
import AuthInput from '../../components/AuthInput';
import { registerTenant } from '../../services/authService';
import { isValidEmail, isValidPhone } from '../../utils/helpers';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';
import type { AuthStackParamList } from '../../types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
}

export default function RegisterScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(): boolean {
    const next: FormErrors = {};

    if (!name.trim()) {
      next.name = 'Full name is required.';
    } else if (name.trim().length < 2) {
      next.name = 'Name must be at least 2 characters.';
    }

    if (!email.trim()) {
      next.email = 'Email is required.';
    } else if (!isValidEmail(email)) {
      next.email = 'Please enter a valid email address.';
    }

    if (!phone.trim()) {
      next.phone = 'Phone number is required.';
    } else if (!isValidPhone(phone)) {
      next.phone = 'Enter a valid 10-digit Indian mobile number.';
    }

    if (!password) {
      next.password = 'Password is required.';
    } else if (password.length < 6) {
      next.password = 'Password must be at least 6 characters.';
    }

    if (!confirmPassword) {
      next.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      next.confirmPassword = 'Passwords do not match.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ── Clear a single field error on change ────────────────────────────────────
  function clearError(field: keyof FormErrors) {
    if (errors[field]) { setErrors(e => ({ ...e, [field]: undefined })); }
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleRegister() {
    if (!validate()) { return; }
    setIsLoading(true);
    try {
      await registerTenant({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
      });
      // AuthContext will pick up the new user and route to TenantApp automatically
      Toast.show({
        type: 'success',
        text1: 'Account Created',
        text2: `Welcome, ${name.trim()}!`,
        position: 'top',
      });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Registration Failed',
        text2: getFirebaseErrorMessage(err),
        position: 'top',
      });
    } finally {
      setIsLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ──────────────────────────────────── */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              accessibilityLabel="Go back"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="arrow-left" size={24} color={Colors.textInverse} />
            </TouchableOpacity>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Create Account</Text>
              <Text style={styles.headerSub}>Register as a tenant</Text>
            </View>
          </View>

          {/* ── Form card ───────────────────────────────── */}
          <View style={styles.card}>

            <AuthInput
              label="Full Name"
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChangeText={text => { setName(text); clearError('name'); }}
              error={errors.name}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <AuthInput
              label="Email Address"
              placeholder="you@example.com"
              value={email}
              onChangeText={text => { setEmail(text); clearError('email'); }}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
            />

            <AuthInput
              label="Phone Number"
              placeholder="10-digit mobile number"
              value={phone}
              onChangeText={text => { setPhone(text); clearError('phone'); }}
              error={errors.phone}
              keyboardType="phone-pad"
              returnKeyType="next"
              maxLength={10}
            />

            <AuthInput
              label="Password"
              placeholder="Minimum 6 characters"
              value={password}
              onChangeText={text => { setPassword(text); clearError('password'); }}
              error={errors.password}
              isPassword
              returnKeyType="next"
            />

            <AuthInput
              label="Confirm Password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChangeText={text => { setConfirmPassword(text); clearError('confirmPassword'); }}
              error={errors.confirmPassword}
              isPassword
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />

            {/* ── Password hint ──────────────────────────── */}
            <View style={styles.hintRow}>
              <Icon name="information-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.hintText}>
                Password must be at least 6 characters.
              </Text>
            </View>

            {/* ── Register button ────────────────────────── */}
            <TouchableOpacity
              style={[styles.registerBtn, isLoading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
              accessibilityLabel="Create account"
              accessibilityRole="button"
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.textInverse} size="small" />
              ) : (
                <Text style={styles.registerBtnText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {/* ── Back to login ──────────────────────────── */}
            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => navigation.navigate('Login')}
              accessibilityLabel="Back to login"
            >
              <Text style={styles.loginLinkText}>
                Already have an account?{' '}
                <Text style={styles.loginLinkBold}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>
            © 2026 Adarsh Infradevelopers & Construction
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: Spacing.xl,
  },

  // ── Header ────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
  headerSub: {
    fontSize: FontSize.sm,
    color: Colors.accent,
    marginTop: 2,
  },

  // ── Card ──────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.base,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0,0,0,0.25)',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 1,
        shadowRadius: 20,
      },
      android: { elevation: 10 },
    }),
  },

  // ── Hint ──────────────────────────────────────────────────
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.lg,
    marginTop: -Spacing.sm,
  },
  hintText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    flexShrink: 1,
  },

  // ── Register button ───────────────────────────────────────
  registerBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  registerBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
    letterSpacing: 0.3,
  },

  // ── Login link ────────────────────────────────────────────
  loginLink: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  loginLinkText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
  loginLinkBold: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },

  // ── Footer ────────────────────────────────────────────────
  footer: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.textInverse,
    opacity: 0.4,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.base,
  },
});
