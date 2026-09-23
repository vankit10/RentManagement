/**
 * AuthContext — Node.js REST API
 *
 * Replaces all Supabase Auth with JWT-based session management.
 *
 * Session flow:
 *   1. App launches → restoreSession() checks stored token via GET /auth/me
 *   2. Login → signIn() stores tokens + user in AsyncStorage
 *   3. Logout → clears tokens, sets user to null
 *   4. Token expiry → apiClient auto-refreshes via POST /auth/refresh-token
 *
 * Role routing:
 *   profile.role === 'owner'  → OwnerApp
 *   profile.role === 'tenant' → TenantApp
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { restoreSession, logout as authLogout } from '../services/authService';
import api from '../services/apiClient';
import { saveUser } from '../services/tokenStorage';
import type { AuthContextType, AuthUser, UserProfile, UserRole } from '../types';

// ─── Context default ──────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  isLoading: true,
  isAuthenticated: false,
  authError: null,
  logout: async () => {},
  updateProfile: async () => {},
  setAuthUser: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // ── Restore session on mount ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const restored = await restoreSession();
        if (!cancelled) {
          setUser(restored);
          setAuthError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn('[AuthContext] session restore failed:', msg);
          setUser(null);
          setAuthError('Could not restore your session. Please log in again.');
        }
      } finally {
        if (!cancelled) { setIsLoading(false); }
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // ── Set user (called by Login screens after signIn()) ─────────────────────
  // Screens call authService.signIn() directly, then call setAuthUser here
  // via the exposed helper so AuthContext reflects the new state.
  const setAuthUser = useCallback((authUser: AuthUser | null) => {
    setUser(authUser);
    setAuthError(null);
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await authLogout();
    } catch (err) {
      console.warn('[AuthContext] logout error:', err);
    } finally {
      setUser(null);
      setAuthError(null);
    }
  }, []);

  // ── Update profile ────────────────────────────────────────────────────────
  const updateProfile = useCallback(async (
    changes: Pick<UserProfile, 'name' | 'email' | 'phone'>,
  ) => {
    if (!user) { throw new Error('You are not signed in.'); }

    await api.patch('/auth/me', changes);

    const updated: AuthUser = {
      ...user,
      email: changes.email ?? user.email,
      phone: changes.phone ?? user.phone,
      profile: {
        ...user.profile!,
        name: changes.name ?? user.profile!.name,
        email: changes.email ?? user.profile?.email,
        phone: changes.phone ?? user.profile!.phone,
      },
    };

    setUser(updated);
    await saveUser(updated);
  }, [user]);

  // ── Role ──────────────────────────────────────────────────────────────────
  const role: UserRole | null = user?.profile?.role ?? null;

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      role,
      isLoading,
      isAuthenticated: !!user,
      authError,
      logout,
      updateProfile,
      // expose setter so login screens can update context after signIn()
      setAuthUser,
    }),
    [user, role, isLoading, authError, logout, updateProfile, setAuthUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export default AuthContext;
