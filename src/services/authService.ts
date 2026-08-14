/**
 * Auth Service — Supabase Auth
 *
 * Supports two login modes for tenants:
 *   1. OTP login  — phone number → receive SMS OTP → verify → signed in
 *   2. Password login — phone number + password (email is derived from phone)
 *
 * Owner always logs in with email + password.
 *
 * Session persistence is handled by the Supabase client (AsyncStorage).
 * onAuthStateChange in AuthContext restores the session on every app launch.
 *
 * NOTE on OTP flow vs Firebase:
 *   Supabase Phone OTP does NOT return a ConfirmationResult object.
 *   The phone number passed to requestOtp() is all that's needed to verify.
 *   Store it in module scope so OTPVerifyScreen can call verifyOtp(phone, token)
 *   without needing to pass anything through navigation params (same pattern
 *   as before, but simpler — just a string, not an opaque object).
 */
import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Module-level pending phone
// Stored here so OTPVerifyScreen can call verifyOtp() with just the token.
// ─────────────────────────────────────────────────────────────────────────────

let _pendingPhone: string | null = null;

export function getPendingPhone(): string | null {
  return _pendingPhone;
}

export function clearPendingPhone(): void {
  _pendingPhone = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// OTP Login — Step 1: Request OTP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a Supabase Phone OTP to the given number.
 * Supabase uses Twilio under the hood (configured in Supabase Dashboard →
 * Authentication → Providers → Phone).
 *
 * @param phone  10-digit Indian number or E.164 format
 */
export async function requestOtp(phone: string): Promise<void> {
  // Normalise to E.164
  const e164 = phone.startsWith('+') ? phone : `+91${phone.trim()}`;
  const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
  if (error) { throw error; }
  _pendingPhone = e164;
}

// ─────────────────────────────────────────────────────────────────────────────
// OTP Login — Step 2: Verify OTP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify the OTP the user entered.
 * On success, Supabase signs the user in and onAuthStateChange fires.
 * AuthContext fetches the profile and routes to the correct dashboard.
 *
 * @param token  6-digit OTP
 * @throws if OTP is wrong, expired, or no pending phone session
 */
export async function verifyOtp(token: string): Promise<void> {
  const phone = _pendingPhone;
  if (!phone) {
    throw new Error('No pending OTP session. Please request a new OTP.');
  }
  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });
  if (error) { throw error; }
  _pendingPhone = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Password Login (tenant)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive a deterministic email from a phone number for Supabase
 * email+password auth.  Format: <10digits>@tenant.adarshinfra.internal
 *
 * This is not a real email — it is only used as the Supabase auth identifier
 * for tenants who choose to set a password. It is never displayed or emailed.
 */
export function phoneToEmail(phone: string): string {
  const digits = phone.replace(/^\+91/, '').replace(/\D/g, '').slice(0, 10);
  return `${digits}@tenant.adarshinfra.internal`;
}

/**
 * Sign in a tenant using their phone-derived email + password.
 */
export async function signInWithPhone(
  phone: string,
  password: string,
): Promise<void> {
  const email = phoneToEmail(phone.trim());
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { throw error; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner / email login
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sign in with email + password.
 * Used directly by the owner.
 */
export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { throw error; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  clearPendingPhone();
  const { error } = await supabase.auth.signOut();
  if (error) { throw error; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tenant self-registration
// ─────────────────────────────────────────────────────────────────────────────

export interface RegisterParams {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: 'tenant' | 'owner';
}

/**
 * Register a user account via Supabase email+password sign-up.
 *
 * Note: the owner must have already registered the tenant's phone number.
 * AuthContext will call linkTenantAccountOnFirstLogin() after sign-up when
 * the profile row doesn't exist yet — the same path as OTP first-login.
 *
 * On success, Supabase signs the user in automatically and onAuthStateChange
 * fires in AuthContext, which routes to TenantApp or OwnerApp based on role.
 */
export async function registerUser(params: RegisterParams): Promise<void> {
  const { name, email, phone, password, role } = params;

  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { name, phone, role },
    },
  });

  if (error) { throw error; }

  // If Supabase requires email confirmation the user won't be signed in yet.
  // The profile row is created by AuthContext after sign-in, so nothing more
  // is needed here.
  if (data.user && !data.session) {
    throw new Error('Please check your email to confirm your account before logging in.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Password reset
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a password-reset email to the owner.
 * Not used for tenants (they use OTP).
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) { throw error; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Session
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the current Supabase session (non-reactive).
 * Prefer using AuthContext for reactive state.
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) { throw error; }
  return data.session;
}
