/**
 * Unified error message mapper for all Supabase errors.
 *
 * Auth-layer errors (OTP, login, registration) are handled here via
 * message-text matching — Supabase Auth does not use short code strings.
 *
 * DB/PostgREST errors are delegated to getSupabaseErrorMessage() so
 * mutation screens that call getFirebaseErrorMessage() also get proper
 * messages for constraint violations, RLS denials, network failures, etc.
 */
import { getSupabaseErrorMessage } from './supabaseErrors';

export function getAuthErrorMessage(error: unknown): string {
  if (!error) {
    return 'Something went wrong. Please try again.';
  }

  const message =
    (typeof error === 'object' && error !== null && 'message' in error)
      ? String((error as { message: string }).message).toLowerCase()
      : String(error).toLowerCase();

  // ── OTP errors ────────────────────────────────────────────────────────────
  if (message.includes('token has expired') || message.includes('otp expired')) {
    return 'OTP has expired. Please request a new one.';
  }
  if (
    message.includes('invalid otp') ||
    message.includes('token is invalid') ||
    message.includes('invalid token')
  ) {
    return 'Incorrect OTP. Please try again.';
  }
  if (message.includes('sms send') || message.includes('unable to send')) {
    return 'Could not send OTP. Please try again in a moment.';
  }

  // ── Login errors ──────────────────────────────────────────────────────────
  if (
    message.includes('invalid login credentials') ||
    message.includes('invalid email or password')
  ) {
    return 'Incorrect email or password.';
  }
  if (message.includes('email not confirmed')) {
    return 'Please verify your email address before logging in.';
  }
  if (message.includes('user not found')) {
    return 'No account found. Please check your details.';
  }
  if (message.includes('user is disabled') || message.includes('user has been banned')) {
    return 'This account has been disabled. Please contact the owner.';
  }

  // ── Rate limits ───────────────────────────────────────────────────────────
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (
    message.includes('email rate limit exceeded') ||
    message.includes('phone rate limit')
  ) {
    return 'Too many OTP requests. Please wait before requesting another.';
  }

  // ── Registration errors ───────────────────────────────────────────────────
  if (message.includes('already registered') || message.includes('user already exists')) {
    return 'An account with this phone number already exists.';
  }
  if (
    message.includes('password should be') ||
    message.includes('password is too short')
  ) {
    return 'Password must be at least 6 characters.';
  }

  // ── Tenant-specific ───────────────────────────────────────────────────────
  if (message.includes('tenant_not_registered')) {
    return 'Your phone number is not registered. Please contact the owner.';
  }

  // ── Session / JWT errors ──────────────────────────────────────────────────
  if (message.includes('jwt expired') || message.includes('session expired')) {
    return 'Your session has expired. Please sign in again.';
  }
  if (message.includes('not authenticated') || message.includes('no session')) {
    return 'You must be signed in to do this.';
  }

  // ── Delegate to DB/PostgREST + network mapper ─────────────────────────────
  // This covers: 23505 unique violations, 23503 FK violations, 42501 RLS,
  // PGRST116 not-found, network errors, Edge Function errors, and the generic
  // fallback — so mutation screens that call getFirebaseErrorMessage() get
  // proper messages for DB-layer failures too.
  return getSupabaseErrorMessage(error);
}

/**
 * Backwards-compatible alias — all existing screens that import
 * getFirebaseErrorMessage continue to compile and behave correctly.
 */
export const getFirebaseErrorMessage = getAuthErrorMessage;
