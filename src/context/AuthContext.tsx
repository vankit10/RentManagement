/**
 * AuthContext — Supabase Auth
 *
 * Session persistence:
 *   The Supabase client is configured with AsyncStorage so the session
 *   survives app restarts. onAuthStateChange fires on every app launch
 *   and restores the session automatically.
 *
 * Phone-auth (OTP) first-login flow:
 *   When a tenant logs in via OTP for the first time their profile row
 *   does not exist yet. linkTenantAccountOnFirstLogin() creates it and
 *   links the auth user UUID to the existing tenants row.
 *   If the phone is not registered by the owner we sign the user out.
 *
 * Subsequent logins:
 *   The profile already exists → loaded directly from the profiles table.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { clearPendingPhone } from '../services/authService';
import { linkTenantAccountOnFirstLogin } from '../services/tenantService';
import type { AuthContextType, AuthUser, UserProfile, UserRole } from '../types';

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  isLoading: true,
  isAuthenticated: false,
  authError: null,
  logout: async () => {},
  updateProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // ── Fetch profile from profiles table ──────────────────────────────────────
  const fetchProfile = useCallback(
    async (authUser: User): Promise<UserProfile | null> => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();

          if (error) {
            // PGRST116 = no rows found (not an error, profile just doesn't exist yet)
            if (error.code === 'PGRST116') { return null; }
            throw error;
          }
          return data as UserProfile;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[AuthContext] fetchProfile attempt ${attempt} failed:`, msg, JSON.stringify(err));
          if (attempt < 3) {
            await new Promise<void>(r => setTimeout(r, attempt * 1000));
          }
        }
      }
      console.error(
        `[AuthContext] All profile fetch attempts failed for id: ${authUser.id}.`,
      );
      // Throw so processUser can surface the error to the user rather than
      // silently sending them to the login screen with no explanation.
      throw new Error('PROFILE_FETCH_FAILED');
    },
    [],
  );

  // ── Handle phone-auth first login ───────────────────────────────────────────
  const handlePhoneUser = useCallback(
    async (authUser: User): Promise<UserProfile | null> => {
      // First check if profile already exists (subsequent logins)
      let profile = await fetchProfile(authUser);   // throws PROFILE_FETCH_FAILED on total failure
      if (profile) { return profile; }

      // First login — link the auth user to the pre-registered tenant record
      const phone = authUser.phone ?? '';

      try {
        await linkTenantAccountOnFirstLogin(authUser.id, phone);
        profile = await fetchProfile(authUser);     // throws PROFILE_FETCH_FAILED on total failure
        return profile;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === 'TENANT_NOT_REGISTERED') {
          console.warn('[AuthContext] Phone not registered by owner. Signing out.');
          await supabase.auth.signOut();
          return null;
        }
        // Re-throw PROFILE_FETCH_FAILED and unexpected errors so processUser can set authError
        throw err;
      }
    },
    [fetchProfile],
  );

  // ── Process a Supabase session/user change ──────────────────────────────────
  const processUser = useCallback(
    async (authUser: User | null) => {
      if (!authUser) {
        setUser(null);
        setAuthError(null);
        setIsLoading(false);
        return;
      }

      console.log(
        '[AuthContext] Signed in — id:', authUser.id,
        '| email:', authUser.email,
        '| phone:', authUser.phone,
      );

      setAuthError(null);
      let profile: UserProfile | null = null;

      try {
        if (authUser.phone && !authUser.email) {
          // Phone-auth user (tenant OTP login)
          profile = await handlePhoneUser(authUser);
        } else if (
          authUser.email &&
          !authUser.phone &&
          authUser.email.endsWith('@tenant.adarshinfra.internal')
        ) {
          // Tenant using phone-derived internal email (signInWithPhone path)
          profile = await fetchProfile(authUser);
          if (!profile) {
            const phone = authUser.email.split('@')[0];
            try {
              await linkTenantAccountOnFirstLogin(authUser.id, phone);
              profile = await fetchProfile(authUser);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              if (msg === 'TENANT_NOT_REGISTERED') {
                console.warn('[AuthContext] Internal-email tenant not registered. Signing out.');
                await supabase.auth.signOut();
              } else if (msg !== 'PROFILE_FETCH_FAILED') {
                console.error('[AuthContext] linkTenantAccountOnFirstLogin (email path) error:', msg);
              } else {
                throw err; // propagate PROFILE_FETCH_FAILED to outer catch
              }
            }
          }
        } else {
          // Email/password user — owner or tenant with a real email address.
          profile = await fetchProfile(authUser);
          if (!profile && authUser.user_metadata?.phone) {
            const phone = String(authUser.user_metadata.phone);
            try {
              await linkTenantAccountOnFirstLogin(authUser.id, phone);
              profile = await fetchProfile(authUser);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              if (msg !== 'PROFILE_FETCH_FAILED') {
                console.warn('[AuthContext] Profile missing for email user, link attempt result:', msg);
              } else {
                throw err;
              }
            }
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === 'PROFILE_FETCH_FAILED') {
          setAuthError('Could not load your account. Please check your connection and try again.');
        } else {
          console.error('[AuthContext] processUser unexpected error:', msg);
          setAuthError('Something went wrong signing you in. Please try again.');
        }
        setUser(null);
        setIsLoading(false);
        return;
      }

      if (profile) {
        setUser({
          id: authUser.id,
          email: authUser.email ?? null,
          phone: authUser.phone ?? null,
          profile,
        });
      } else {
        setUser(null);
      }
      setIsLoading(false);
    },
    [fetchProfile, handlePhoneUser],
  );

  // ── Auth state listener ─────────────────────────────────────────────────────
  useEffect(() => {
    // Load the existing session immediately on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      processUser(session?.user ?? null);
    });

    // Subscribe to future auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        processUser(session?.user ?? null);
      },
    );

    return () => subscription.unsubscribe();
  }, [processUser]);

  // ── Logout ──────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      clearPendingPhone();
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[AuthContext] logout error:', err);
    }
  }, []);

  const updateProfile = useCallback(async (
    changes: Pick<UserProfile, 'name' | 'email' | 'phone'>,
  ) => {
    if (!user?.id) { throw new Error('You are not signed in.'); }
    const { data, error } = await supabase
      .from('profiles')
      .update(changes)
      .eq('id', user.id)
      .select('*')
      .single();
    if (error) { throw error; }
    setUser(current => current ? { ...current, profile: data as UserProfile } : current);
  }, [user?.id]);

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
    }),
    [user, role, isLoading, authError, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export default AuthContext;
