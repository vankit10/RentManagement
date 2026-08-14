/**
 * LoginScreen
 *
 * Single smart input field that accepts either a phone number or an email:
 *   - Phone number  → OTP flow  → OTPVerifyScreen
 *   - Email address → password field appears → signIn() (owner / email auth)
 *
 * "Password Login" tab: phone + password (for tenants with a password set).
 *
 * Detection logic:
 *   - If the identifier contains "@" it is treated as email.
 *   - Otherwise it is treated as a phone number.
 *   - Keyboard stays as default (not phone-pad) so letters and @ are always
 *     reachable on-device.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
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
import { signIn, signInWithPhone, requestOtp } from '../../services/authService';
import { isValidPhone, isValidEmail } from '../../utils/helpers';
import { getFirebaseErrorMessage } from '../../utils/authErrors';
import type { AuthStackParamList } from '../../types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;
type LoginMode = 'otp' | 'password';

export default function LoginScreen({ navigation }: Props) {
  const [mode, setMode] = useState<LoginMode>('otp');

  // ── OTP tab — single identifier field (phone OR email) ───────────────────
  // When it contains "@" we treat it as email and show the password field.
  const [identifier, setIdentifier] = useState('');
  const [identifierError, setIdentifierError] = useState('');

  // Shown only when identifier looks like an email
  const [emailPassword, setEmailPassword] = useState('');
  const [emailPasswordError, setEmailPasswordError] = useState('');

  // Password tab fields — identifier accepts phone OR real email
  const [pwIdentifier, setPwIdentifier] = useState('');
  const [pwIdentifierError, setPwIdentifierError] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  // True when the identifier looks like an email address
  const isEmailMode = identifier.includes('@');
  // True when the password-tab identifier looks like an email
  const isPwEmailMode = pwIdentifier.includes('@');

  // ── Identifier field change ───────────────────────────────────────────────
  function handleIdentifierChange(text: string) {
    setIdentifier(text);
    setIdentifierError('');
    // Clear email password error when user edits identifier back to phone
    if (!text.includes('@')) {
      setEmailPasswordError('');
    }
  }

  // ── OTP Login (phone path) ────────────────────────────────────────────────
  async function handleSendOtp() {
    const value = identifier.trim();
    if (!value) {
      setIdentifierError('Mobile number is required.');
      return;
    }
    if (!isValidPhone(value)) {
      setIdentifierError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setIdentifierError('');
    setIsLoading(true);
    try {
      await requestOtp(value);
      navigation.navigate('OTPVerify', { phone: value });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'OTP Failed',
        text2: getFirebaseErrorMessage(err),
        position: 'top',
      });
    } finally {
      setIsLoading(false);
    }
  }

  // ── Email login (owner / email-password path) ─────────────────────────────
  async function handleEmailLogin() {
    let valid = true;
    if (!identifier.trim() || !isValidEmail(identifier)) {
      setIdentifierError('Enter a valid email address.');
      valid = false;
    } else {
      setIdentifierError('');
    }
    if (!emailPassword || emailPassword.length < 6) {
      setEmailPasswordError('Password must be at least 6 characters.');
      valid = false;
    } else {
      setEmailPasswordError('');
    }
    if (!valid) { return; }

    setIsLoading(true);
    try {
      await signIn(identifier.trim().toLowerCase(), emailPassword);
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: getFirebaseErrorMessage(err),
        position: 'top',
      });
    } finally {
      setIsLoading(false);
    }
  }

  // ── Password Login — accepts phone OR real email ─────────────────────────
  async function handlePasswordLogin() {
    let valid = true;
    const id = pwIdentifier.trim();

    if (!id) {
      setPwIdentifierError('Enter your mobile number or email address.');
      valid = false;
    } else if (isPwEmailMode) {
      if (!isValidEmail(id)) {
        setPwIdentifierError('Enter a valid email address.');
        valid = false;
      } else {
        setPwIdentifierError('');
      }
    } else {
      if (!isValidPhone(id)) {
        setPwIdentifierError('Enter a valid 10-digit Indian mobile number.');
        valid = false;
      } else {
        setPwIdentifierError('');
      }
    }

    if (!password || password.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      valid = false;
    } else {
      setPasswordError('');
    }
    if (!valid) { return; }

    setIsLoading(true);
    try {
      if (isPwEmailMode) {
        // Real email login (tenant registered with email+password by owner)
        await signIn(id.toLowerCase(), password);
      } else {
        // Phone-derived internal email login (legacy phone+password path)
        await signInWithPhone(id, password);
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: getFirebaseErrorMessage(err),
        position: 'top',
      });
    } finally {
      setIsLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
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
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.logoCard}>
              <Image
                source={require('../../assets/images/logo.jpg')}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="Adarsh Infradevelopers logo"
              />
            </View>
            <Text style={styles.heroTitle}>Rent Management</Text>
            <Text style={styles.heroSub}>Adarsh Infradevelopers & Construction</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome Back</Text>
            <Text style={styles.cardSub}>Sign in to continue</Text>

            {/* Mode tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, mode === 'otp' && styles.tabActive]}
                onPress={() => {
                  setMode('otp');
                  setIdentifier('');
                  setIdentifierError('');
                  setEmailPassword('');
                  setEmailPasswordError('');
                }}
                accessibilityLabel="OTP Login"
              >
                <Icon
                  name="cellphone-key"
                  size={16}
                  color={mode === 'otp' ? Colors.primary : Colors.textMuted}
                />
                <Text style={[styles.tabText, mode === 'otp' && styles.tabTextActive]}>
                  OTP Login
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, mode === 'password' && styles.tabActive]}
                onPress={() => {
                  setMode('password');
                  setPwIdentifier('');
                  setPwIdentifierError('');
                  setPassword('');
                  setPasswordError('');
                }}
                accessibilityLabel="Password Login"
              >
                <Icon
                  name="lock-outline"
                  size={16}
                  color={mode === 'password' ? Colors.primary : Colors.textMuted}
                />
                <Text style={[styles.tabText, mode === 'password' && styles.tabTextActive]}>
                  Password
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── OTP / Email tab ───────────────────── */}
            {mode === 'otp' && (
              <>
                {/* Single smart field — accepts phone OR email */}
                <AuthInput
                  label={isEmailMode ? 'Email Address' : 'Phone Number'}
                  placeholder="Mobile number or email address"
                  value={identifier}
                  onChangeText={handleIdentifierChange}
                  error={identifierError}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType={isEmailMode ? 'next' : 'done'}
                  onSubmitEditing={isEmailMode ? undefined : handleSendOtp}
                />

                {/* Hint changes based on what the user typed */}
                {!isEmailMode && (
                  <Text style={styles.hint}>
                    <Icon name="information-outline" size={13} color={Colors.textMuted} />
                    {'  '}You will receive a 6-digit OTP on this number.
                  </Text>
                )}

                {/* Password field — only when identifier looks like an email */}
                {isEmailMode && (
                  <>
                    <AuthInput
                      label="Password"
                      placeholder="Enter your password"
                      value={emailPassword}
                      onChangeText={text => { setEmailPassword(text); setEmailPasswordError(''); }}
                      error={emailPasswordError}
                      isPassword
                      returnKeyType="done"
                      onSubmitEditing={handleEmailLogin}
                    />
                    <TouchableOpacity
                      style={styles.forgotBtn}
                      onPress={() => navigation.navigate('ForgotPassword')}
                    >
                      <Text style={styles.forgotText}>Forgot Password?</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* CTA button — label changes based on mode */}
                <TouchableOpacity
                  style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
                  onPress={isEmailMode ? handleEmailLogin : handleSendOtp}
                  disabled={isLoading}
                  accessibilityLabel={isEmailMode ? 'Sign In' : 'Send OTP'}
                  accessibilityRole="button"
                >
                  {isLoading ? (
                    <ActivityIndicator color={Colors.textInverse} size="small" />
                  ) : isEmailMode ? (
                    <>
                      <Icon name="login" size={18} color={Colors.textInverse} />
                      <Text style={styles.primaryBtnText}>Sign In</Text>
                    </>
                  ) : (
                    <>
                      <Icon name="message-text-outline" size={18} color={Colors.textInverse} />
                      <Text style={styles.primaryBtnText}>Send OTP</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* ── Password mode ──────────────────────── */}
            {mode === 'password' && (
              <>
                <AuthInput
                  label={isPwEmailMode ? 'Email Address' : 'Mobile Number or Email'}
                  placeholder="Mobile number or email address"
                  value={pwIdentifier}
                  onChangeText={text => { setPwIdentifier(text); setPwIdentifierError(''); }}
                  error={pwIdentifierError}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
                {!isPwEmailMode && (
                  <Text style={styles.hint}>
                    <Icon name="information-outline" size={13} color={Colors.textMuted} />
                    {'  '}Enter your 10-digit mobile number or email address.
                  </Text>
                )}
                <AuthInput
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={text => { setPassword(text); setPasswordError(''); }}
                  error={passwordError}
                  isPassword
                  returnKeyType="done"
                  onSubmitEditing={handlePasswordLogin}
                />
                <TouchableOpacity
                  style={styles.forgotBtn}
                  onPress={() => navigation.navigate('ForgotPassword')}
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
                  onPress={handlePasswordLogin}
                  disabled={isLoading}
                  accessibilityLabel="Sign In"
                  accessibilityRole="button"
                >
                  {isLoading ? (
                    <ActivityIndicator color={Colors.textInverse} size="small" />
                  ) : (
                    <>
                      <Icon name="login" size={18} color={Colors.textInverse} />
                      <Text style={styles.primaryBtnText}>Sign In</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Divider + register */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>New tenant?</Text>
              <View style={styles.dividerLine} />
            </View>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('Register')}
              accessibilityLabel="Create Account"
              accessibilityRole="button"
            >
              <Text style={styles.secondaryBtnText}>Create Account</Text>
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
  safe: { flex: 1, backgroundColor: Colors.primary },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: Spacing.xl },

  hero: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.xxl,
  },
  logo: { width: 240, height: 72 },
  logoCard: {
    backgroundColor: Colors.textInverse,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: Spacing.lg,
    ...Platform.select({
      ios: { shadowColor: 'rgba(0,0,0,0.3)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  heroTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.accent, textAlign: 'center' },
  heroSub: { fontSize: FontSize.sm, color: Colors.textInverse, opacity: 0.7, textAlign: 'center', marginTop: Spacing.xs },

  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.base,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    ...Platform.select({
      ios: { shadowColor: 'rgba(0,0,0,0.25)', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 20 },
      android: { elevation: 10 },
    }),
  },
  cardTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary, marginBottom: Spacing.xs },
  cardSub: { fontSize: FontSize.base, color: Colors.textSecondary, marginBottom: Spacing.lg },

  // Mode tabs
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    padding: 4,
    marginBottom: Spacing.lg,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.xs,
  },
  tabActive: { backgroundColor: Colors.surface, ...Platform.select({ ios: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 3 }, android: { elevation: 2 } }) },
  tabText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textMuted },
  tabTextActive: { color: Colors.primary, fontWeight: FontWeight.semiBold },

  hint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: -Spacing.sm, marginBottom: Spacing.lg, lineHeight: 18 },

  forgotBtn: { alignSelf: 'flex-end', marginTop: -Spacing.sm, marginBottom: Spacing.lg },
  forgotText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    minHeight: 50,
  },
  btnDisabled: { opacity: 0.7 },
  primaryBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textInverse, letterSpacing: 0.3 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.lg, gap: Spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: FontSize.sm, color: Colors.textMuted },

  secondaryBtn: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  secondaryBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.semiBold, color: Colors.primary },

  footer: { textAlign: 'center', fontSize: FontSize.xs, color: Colors.textInverse, opacity: 0.4, marginTop: Spacing.xl, paddingHorizontal: Spacing.base },
});
