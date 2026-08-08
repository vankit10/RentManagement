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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants';
import AuthInput from '../../components/AuthInput';
import { signIn } from '../../services/authService';
import { isValidEmail } from '../../utils/helpers';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';
import type { AuthStackParamList } from '../../types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

interface FormErrors {
  email?: string;
  password?: string;
}

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(): boolean {
    const next: FormErrors = {};

    if (!email.trim()) {
      next.email = 'Email is required.';
    } else if (!isValidEmail(email)) {
      next.email = 'Please enter a valid email address.';
    }

    if (!password) {
      next.password = 'Password is required.';
    } else if (password.length < 6) {
      next.password = 'Password must be at least 6 characters.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleLogin() {
    if (!validate()) { return; }
    setIsLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      // AuthContext onAuthStateChanged will route to the correct dashboard
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
          {/* ── Hero banner ─────────────────────────────── */}
          <View style={styles.hero}>
            <Image
              source={require('../../assets/images/logo.jpg')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Adarsh Infradevelopers logo"
            />
            <Text style={styles.heroTitle}>Rent Management</Text>
            <Text style={styles.heroSub}>Adarsh Infradevelopers & Construction</Text>
          </View>

          {/* ── Form card ───────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome Back</Text>
            <Text style={styles.cardSub}>Sign in to your account</Text>

            <AuthInput
              label="Email Address"
              placeholder="you@example.com"
              value={email}
              onChangeText={text => {
                setEmail(text);
                if (errors.email) { setErrors(e => ({ ...e, email: undefined })); }
              }}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
            />

            <AuthInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={text => {
                setPassword(text);
                if (errors.password) { setErrors(e => ({ ...e, password: undefined })); }
              }}
              error={errors.password}
              isPassword
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            {/* ── Forgot password ────────────────────────── */}
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => navigation.navigate('ForgotPassword')}
              accessibilityLabel="Forgot password"
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* ── Login button ───────────────────────────── */}
            <TouchableOpacity
              style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              accessibilityLabel="Sign in"
              accessibilityRole="button"
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.textInverse} size="small" />
              ) : (
                <Text style={styles.loginBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* ── Divider ────────────────────────────────── */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>New tenant?</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* ── Register link ──────────────────────────── */}
            <TouchableOpacity
              style={styles.registerBtn}
              onPress={() => navigation.navigate('Register')}
              accessibilityLabel="Create account"
              accessibilityRole="button"
            >
              <Text style={styles.registerBtnText}>Create Account</Text>
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

  // ── Hero ──────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.xxl,
  },
  logo: {
    width: 240,
    height: 72,
    tintColor: Colors.textInverse,
    marginBottom: Spacing.lg,
  },
  heroTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.accent,
    textAlign: 'center',
  },
  heroSub: {
    fontSize: FontSize.sm,
    color: Colors.textInverse,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: Spacing.xs,
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
    marginBottom: Spacing.xs,
  },
  cardSub: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },

  // ── Forgot password ───────────────────────────────────────
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: -Spacing.sm,
    marginBottom: Spacing.lg,
  },
  forgotText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },

  // ── Login button ──────────────────────────────────────────
  loginBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
    letterSpacing: 0.3,
  },

  // ── Divider ───────────────────────────────────────────────
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },

  // ── Register button ───────────────────────────────────────
  registerBtn: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  registerBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    color: Colors.primary,
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
