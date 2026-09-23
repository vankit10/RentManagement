/**
 * Auth Service — Node.js REST API
 *
 * Replaces all Supabase Auth calls with calls to the Node.js backend.
 *
 * Login methods:
 *   - Owner        : email + password → POST /auth/login
 *   - Tenant       : phone + password → POST /auth/login (phone used as identifier)
 *
 * Session persistence:
 *   Tokens are stored in AsyncStorage via tokenStorage.ts.
 *   On app launch AuthContext calls restoreSession() to reload the user.
 */
import api from './apiClient';
import { saveTokens, clearTokens, saveUser, getStoredUser, getRefreshToken } from './tokenStorage';
import type { AuthUser } from '../types';

// ─── API response shapes ──────────────────────────────────────────────────────

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: string;
    organizationId: string;
  };
}

export function normalizeAuthResponse(payload: unknown): LoginResponse {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid login response from server.');
  }

  const record = payload as Record<string, unknown>;

  // apiClient already unwraps { success: true, data: {...} } → {...}
  // So we check the direct structure first
  if (
    typeof record.accessToken === 'string' && 
    typeof record.refreshToken === 'string' && 
    record.user && 
    typeof record.user === 'object'
  ) {
    return record as unknown as LoginResponse;
  }

  // Fallback: check if it's still wrapped (shouldn't happen with apiClient)
  if (record.success === true && record.data && typeof record.data === 'object') {
    const wrapped = record.data as Record<string, unknown>;
    if (
      typeof wrapped.accessToken === 'string' && 
      typeof wrapped.refreshToken === 'string' && 
      wrapped.user &&
      typeof wrapped.user === 'object'
    ) {
      return wrapped as unknown as LoginResponse;
    }
  }

  throw new Error('Invalid login response from server.');
}

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Email + password login — used by owner and tenants with email credentials.
 */
export async function signIn(email: string, password: string): Promise<AuthUser> {
  try {
    const rawResponse = await api.post<unknown>('/auth/login', { email, password });
    console.log('[authService] Raw API response:', JSON.stringify(rawResponse, null, 2));
    
    const response = normalizeAuthResponse(rawResponse);
    console.log('[authService] Normalized response:', JSON.stringify(response, null, 2));

    await saveTokens(response.accessToken, response.refreshToken);

    const authUser: AuthUser = {
      id: response.user.id,
      email: response.user.email,
      phone: response.user.phone,
      profile: {
        id: response.user.id,
        name: response.user.name,
        email: response.user.email ?? undefined,
        phone: response.user.phone ?? '',
        role: response.user.role === 'OWNER' || response.user.role === 'owner' ? 'owner' : 'tenant',
        created_at: new Date().toISOString(),
      },
    };

    await saveUser(authUser);
    return authUser;
  } catch (error) {
    console.error('[authService] signIn error:', error);
    throw error;
  }
}

/**
 * Phone + password login — for tenants who log in with their mobile number.
 * The backend accepts phone as the identifier directly.
 */
export async function signInWithPhone(phone: string, password: string): Promise<AuthUser> {
  // Backend accepts phone number directly as identifier
  const digits = phone.replace(/\D/g, '').slice(-10);
  // Try phone as email format that backend understands
  return signIn(`${digits}@tenant.adarshinfra.internal`, password);
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  try {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken });
    }
  } catch {
    // Ignore — clear local tokens regardless
  } finally {
    await clearTokens();
  }
}

// ─── Session restore ──────────────────────────────────────────────────────────

/**
 * Called by AuthContext on app launch.
 * Returns the stored user if a valid session exists, null otherwise.
 */
export async function restoreSession(): Promise<AuthUser | null> {
  try {
    // Try fetching /auth/me — apiClient auto-refreshes token if needed
    const data = await api.get<{
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      role: string;
      organizationId: string;
    }>('/auth/me');

    const authUser: AuthUser = {
      id: data.id,
      email: data.email,
      phone: data.phone,
      profile: {
        id: data.id,
        name: data.name,
        email: data.email ?? undefined,
        phone: data.phone ?? '',
        role: data.role === 'OWNER' ? 'owner' : 'tenant',
        created_at: new Date().toISOString(),
      },
    };

    await saveUser(authUser);
    return authUser;
  } catch {
    // Token invalid or expired and refresh failed — clear storage
    await clearTokens();
    return null;
  }
}

// ─── Change password ──────────────────────────────────────────────────────────

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await api.patch('/auth/change-password', { currentPassword, newPassword });
}

// ─── Forgot password (owner only) ────────────────────────────────────────────

export async function sendPasswordReset(_email: string): Promise<void> {
  // Not yet implemented in the Node.js backend — placeholder
  throw new Error('Password reset is not yet available. Please contact the administrator.');
}

// ─── Kept for compatibility with OTPVerifyScreen ──────────────────────────────
// OTP login is not yet supported in the Node.js backend (SMS excluded).
// These stubs throw a clear message so the UI shows a useful error.

export function getPendingPhone(): string | null { return null; }
export function clearPendingPhone(): void { /* no-op */ }

export async function requestOtp(_phone: string): Promise<void> {
  throw new Error('OTP login is not yet available. Please use password login.');
}

export async function verifyOtp(_token: string): Promise<void> {
  throw new Error('OTP login is not yet available. Please use password login.');
}
