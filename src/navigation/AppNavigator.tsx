import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import SplashScreen from '../screens/SplashScreen';
import AuthNavigator from './AuthNavigator';
import TenantNavigator from './TenantNavigator';
import OwnerNavigator from './OwnerNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root navigator.
 * - While Firebase resolves auth state: show SplashScreen.
 * - Unauthenticated: Auth stack (Login / Register / ForgotPassword).
 * - Tenant: Tenant bottom tab navigator.
 * - Owner: Owner stack navigator (tabs + push screens).
 */
export default function AppNavigator() {
  const { isLoading, isAuthenticated, role } = useAuth();

  // Hold on splash while Firebase onAuthStateChanged fires
  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {!isAuthenticated ? (
        // ── Auth flow ──────────────────────────────────────────────────────────
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : role === 'owner' ? (
        // ── Owner flow ─────────────────────────────────────────────────────────
        <Stack.Screen name="OwnerApp" component={OwnerNavigator} />
      ) : (
        // ── Tenant flow ────────────────────────────────────────────────────────
        <Stack.Screen name="TenantApp" component={TenantNavigator} />
      )}
    </Stack.Navigator>
  );
}
