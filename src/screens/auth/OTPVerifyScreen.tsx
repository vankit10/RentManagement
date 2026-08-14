/**
 * OTPVerifyScreen
 *
 * Receives the phone number from navigation params.
 * Reads the ConfirmationResult from authService module scope (not from params —
 * ConfirmationResult is not JSON-serialisable).
 *
 * Auto-submits when all 6 digits are entered.
 * Allows resend after a 30-second cooldown.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants';
import { verifyOtp, requestOtp } from '../../services/authService';
import { getFirebaseErrorMessage } from '../../utils/authErrors';
import type { AuthStackParamList } from '../../types';

type Props = NativeStackScreenProps<AuthStackParamList, 'OTPVerify'>;

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30; // seconds

export default function OTPVerifyScreen({ route, navigation }: Props) {
  const { phone } = route.params;

  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [error, setError] = useState('');

  const inputRef = useRef<TextInput>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start cooldown timer on mount
  useEffect(() => {
    startCooldown();
    // Focus the input after mount
    const t = setTimeout(() => inputRef.current?.focus(), 400);
    return () => {
      clearTimeout(t);
      if (cooldownRef.current) { clearInterval(cooldownRef.current); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN);
    if (cooldownRef.current) { clearInterval(cooldownRef.current); }
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // ── Auto-submit when 6 digits entered ──────────────────────────────────────
  useEffect(() => {
    if (otp.length === OTP_LENGTH) {
      handleVerify(otp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  // ── Verify OTP ─────────────────────────────────────────────────────────────
  const handleVerify = useCallback(
    async (code: string) => {
      if (code.length !== OTP_LENGTH) {
        setError(`Enter the ${OTP_LENGTH}-digit OTP.`);
        return;
      }
      setError('');
      setIsVerifying(true);
      try {
        await verifyOtp(code);
        // AuthContext onAuthStateChanged fires → routes to dashboard automatically
      } catch (err) {
        const msg = getFirebaseErrorMessage(err);
        setError(msg);
        setOtp('');
        Toast.show({
          type: 'error',
          text1: 'Verification Failed',
          text2: msg,
          position: 'top',
        });
      } finally {
        setIsVerifying(false);
      }
    },
    [],
  );

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  const handleResend = useCallback(async () => {
    if (cooldown > 0) { return; }
    setIsResending(true);
    setOtp('');
    setError('');
    try {
      await requestOtp(phone);
      startCooldown();
      Toast.show({
        type: 'success',
        text1: 'OTP Sent',
        text2: `A new OTP was sent to ${phone}`,
        position: 'top',
      });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Resend Failed',
        text2: getFirebaseErrorMessage(err),
        position: 'top',
      });
    } finally {
      setIsResending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooldown, phone]);

  // ── OTP digit boxes ────────────────────────────────────────────────────────
  const digits = otp.padEnd(OTP_LENGTH, ' ').split('');

  // Format phone for display
  const maskedPhone =
    phone.length === 10
      ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`
      : phone;

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
          {/* Header */}
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
              <Text style={styles.headerTitle}>Verify OTP</Text>
              <Text style={styles.headerSub}>Enter the code sent to your phone</Text>
            </View>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {/* Phone icon + description */}
            <View style={styles.iconWrap}>
              <Icon name="cellphone-message" size={40} color={Colors.primary} />
            </View>
            <Text style={styles.description}>
              We sent a 6-digit OTP to
            </Text>
            <Text style={styles.phoneDisplay}>{maskedPhone}</Text>

            {/* OTP digit boxes (tap to open hidden input) */}
            <TouchableOpacity
              style={styles.otpRow}
              onPress={() => inputRef.current?.focus()}
              activeOpacity={0.8}
              accessibilityLabel="OTP input"
            >
              {digits.map((digit, idx) => {
                const isFilled = idx < otp.length;
                const isCursor = idx === otp.length && otp.length < OTP_LENGTH;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.digitBox,
                      isFilled && styles.digitBoxFilled,
                      isCursor && styles.digitBoxCursor,
                      error ? styles.digitBoxError : null,
                    ]}
                  >
                    <Text style={styles.digitText}>
                      {isFilled ? digit : isCursor ? '|' : ''}
                    </Text>
                  </View>
                );
              })}
            </TouchableOpacity>

            {/* Hidden real input */}
            <TextInput
              ref={inputRef}
              value={otp}
              onChangeText={text => {
                setError('');
                setOtp(text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH));
              }}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              style={styles.hiddenInput}
              accessible={false}
              importantForAccessibility="no"
            />

            {/* Error message */}
            {!!error && (
              <View style={styles.errorRow}>
                <Icon name="alert-circle-outline" size={14} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Verify button */}
            <TouchableOpacity
              style={[
                styles.verifyBtn,
                (isVerifying || otp.length < OTP_LENGTH) && styles.btnDisabled,
              ]}
              onPress={() => handleVerify(otp)}
              disabled={isVerifying || otp.length < OTP_LENGTH}
              accessibilityLabel="Verify OTP"
              accessibilityRole="button"
            >
              {isVerifying ? (
                <ActivityIndicator color={Colors.textInverse} size="small" />
              ) : (
                <>
                  <Icon name="check-circle-outline" size={18} color={Colors.textInverse} />
                  <Text style={styles.verifyBtnText}>Verify & Login</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Resend */}
            <View style={styles.resendRow}>
              <Text style={styles.resendLabel}>Didn't receive the OTP?</Text>
              {cooldown > 0 ? (
                <Text style={styles.resendCooldown}>
                  Resend in {cooldown}s
                </Text>
              ) : (
                <TouchableOpacity
                  onPress={handleResend}
                  disabled={isResending}
                  accessibilityLabel="Resend OTP"
                >
                  {isResending ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Text style={styles.resendLink}>Resend OTP</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textInverse },
  headerSub: { fontSize: FontSize.sm, color: Colors.accent, marginTop: 2 },

  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.base,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: 'rgba(0,0,0,0.25)', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 20 },
      android: { elevation: 10 },
    }),
  },

  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  description: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center' },
  phoneDisplay: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },

  // OTP digit row
  otpRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  digitBox: {
    width: 44,
    height: 52,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitBoxFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceSecondary,
  },
  digitBoxCursor: {
    borderColor: Colors.accent,
  },
  digitBoxError: {
    borderColor: Colors.error,
  },
  digitText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },

  // Hidden real text input sits off-screen but remains focusable
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.base,
  },
  errorText: { fontSize: FontSize.sm, color: Colors.error, flex: 1 },

  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    width: '100%',
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    minHeight: 50,
    marginBottom: Spacing.lg,
  },
  btnDisabled: { opacity: 0.5 },
  verifyBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textInverse, letterSpacing: 0.3 },

  resendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  resendLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  resendLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semiBold },
  resendCooldown: { fontSize: FontSize.sm, color: Colors.textMuted },

  footer: { textAlign: 'center', fontSize: FontSize.xs, color: Colors.textInverse, opacity: 0.4, marginTop: Spacing.xl, paddingHorizontal: Spacing.base },
});
