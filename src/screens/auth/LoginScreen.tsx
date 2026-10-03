/**
 * LoginScreen
 *
 * Email-and-password authentication only.
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
import { signIn } from '../../services/authService';
import { isValidEmail } from '../../utils/helpers';
import { getFirebaseErrorMessage } from '../../utils/authErrors';
import { useAuth } from '../../context/AuthContext';
import { logButtonPress } from '../../utils/logger';
import type { AuthStackParamList } from '../../types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export default function LoginScreen({ navigation }: Props) {
  const { setAuthUser } = useAuth();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  async function handleEmailLogin() {
    logButtonPress('LoginScreen', 'email_login', { identifier: email.trim().toLowerCase() });
    let valid = true;
    if (!email.trim() || !isValidEmail(email)) {
      setEmailError('Enter a valid email address.');
      valid = false;
    } else {
      setEmailError('');
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
      const authUser = await signIn(email.trim().toLowerCase(), password);
      setAuthUser(authUser);
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

            <AuthInput
              label="Email Address"
              placeholder="Enter your email address"
              value={email}
              onChangeText={text => { setEmail(text); setEmailError(''); }}
              error={emailError}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
            <AuthInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={text => { setPassword(text); setPasswordError(''); }}
              error={passwordError}
              isPassword
              returnKeyType="done"
              onSubmitEditing={handleEmailLogin}
            />
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => {
                logButtonPress('LoginScreen', 'forgot_password');
                navigation.navigate('ForgotPassword');
              }}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
              onPress={handleEmailLogin}
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

            {/* Divider + register */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>New tenant?</Text>
              <View style={styles.dividerLine} />
            </View>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                logButtonPress('LoginScreen', 'go_to_register');
                navigation.navigate('Register');
              }}
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
