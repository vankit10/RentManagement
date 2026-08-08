import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from '@react-native-firebase/auth';
import { doc, getDoc } from '@react-native-firebase/firestore';
import type { User } from '@react-native-firebase/auth';
import { auth, db } from '../services/firebase';
import type { AuthContextType, AuthUser, UserProfile, UserRole } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  isLoading: true,
  isAuthenticated: false,
  logout: async () => {},
});

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch the Firestore profile for an authenticated Firebase user
  const fetchProfile = useCallback(
    async (firebaseUser: User): Promise<UserProfile | null> => {
      try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          return { uid: firebaseUser.uid, ...userDoc.data() } as UserProfile;
        }
        return null;
      } catch (err) {
        console.warn('[AuthContext] fetchProfile error:', err);
        return null;
      }
    },
    [],
  );

  // Subscribe to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await fetchProfile(firebaseUser);
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          profile,
        });
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, [fetchProfile]);

  const logout = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.warn('[AuthContext] logout error:', err);
    }
  }, []);

  const role: UserRole | null = user?.profile?.role ?? null;

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      role,
      isLoading,
      isAuthenticated: !!user,
      logout,
    }),
    [user, role, isLoading, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export default AuthContext;
