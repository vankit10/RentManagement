import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants';
import AuthInput from '../../components/AuthInput';
import { sendPasswordReset } from '../../services/authService';
import { isValidEmail } from '../../utils/helpers';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';
import { logButtonPress } from '../../utils/logger';
import type { AuthStackParamList } from '../../types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(): boolean {
    if (!email.trim()) {
      setEmailError('Email is required.');
      return false;
    }
    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address.');
      return false;
    }
    setEmailError('');
    return true;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleReset() {
    logButtonPress('ForgotPasswordScreen', 'send_reset_link', { email: email.trim().toLowerCase() });
    if (!validate()) { return; }
    setIsLoading(true);
    try {
      await sendPasswordReset(email.trim().toLowerCase());
      setIsSuccess(true);
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Reset Failed',
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
              onPress={() => {
                logButtonPress('ForgotPasswordScreen', 'go_back');
                navigation.goBack();
              }}
              style={styles.backBtn}
              accessibilityLabel="Go back"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="arrow-left" size={24} color={Colors.textInverse} />
            </TouchableOpacity>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Reset Password</Text>
              <Text style={styles.headerSub}>
                We'll send a reset link to your email
              </Text>
            </View>
          </View>

          {/* ── Card ────────────────────────────────────── */}
          <View style={styles.card}>
            {isSuccess ? (
              // ── Success state ──────────────────────────
              <View style={styles.successContainer}>
                <View style={styles.successIcon}>
                  <Icon
                    name="email-check-outline"
                    size={52}
                    color={Colors.success}
                  />
                </View>
                <Text style={styles.successTitle}>Email Sent!</Text>
                <Text style={styles.successBody}>
                  A password reset link has been sent to{'\n'}
                  <Text style={styles.successEmail}>{email.trim()}</Text>
                </Text>
                <Text style={styles.successHint}>
                  Check your inbox and follow the link to reset your password.
                  The link expires in 1 hour.
                </Text>
                <TouchableOpacity
                  style={styles.backToLoginBtn}
                  onPress={() => {
                    logButtonPress('ForgotPasswordScreen', 'back_to_login');
                    navigation.navigate('Login');
                  }}
                  accessibilityLabel="Back to login"
                  accessibilityRole="button"
                >
                  <Text style={styles.backToLoginText}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // ── Input state ────────────────────────────
              <>
                <Text style={styles.cardTitle}>Forgot Password?</Text>
                <Text style={styles.cardSub}>
                  Enter your registered email address and we'll send you a link
                  to reset your password.
                </Text>

                <AuthInput
                  label="Email Address"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={text => {
                    setEmail(text);
                    if (emailError) { setEmailError(''); }
                  }}
                  error={emailError}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleReset}
                />

                <TouchableOpacity
                  style={[styles.resetBtn, isLoading && styles.btnDisabled]}
                  onPress={handleReset}
                  disabled={isLoading}
                  accessibilityLabel="Send reset link"
                  accessibilityRole="button"
                >
                  {isLoading ? (
                    <ActivityIndicator color={Colors.textInverse} size="small" />
                  ) : (
                    <Text style={styles.resetBtnText}>Send Reset Link</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    logButtonPress('ForgotPasswordScreen', 'cancel_reset');
                    navigation.navigate('Login');
                  }}
                  accessibilityLabel="Back to login"
                >
                  <Text style={styles.cancelBtnText}>Back to Sign In</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
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
  cardTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  cardSub: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },

  // ── Buttons ───────────────────────────────────────────────
  resetBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginTop: Spacing.sm,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  resetBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
    letterSpacing: 0.3,
  },
  cancelBtn: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  cancelBtnText: {
    fontSize: FontSize.base,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },

  // ── Success state ──────────────────────────────────────────
  successContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  successTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    marginBottom: Spacing.md,
  },
  successBody: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  successEmail: {
    fontWeight: FontWeight.semiBold,
    color: Colors.primary,
  },
  successHint: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xxl,
    paddingHorizontal: Spacing.sm,
  },
  backToLoginBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    alignSelf: 'stretch',
  },
  backToLoginText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
    letterSpacing: 0.3,
  },
});
