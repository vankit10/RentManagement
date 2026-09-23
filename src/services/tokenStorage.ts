/**
 * Token Storage — AsyncStorage helpers
 * Persists JWT access + refresh tokens across app restarts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthUser } from '../types';

const KEYS = {
  ACCESS_TOKEN:  '@rms/access_token',
  REFRESH_TOKEN: '@rms/refresh_token',
  USER:          '@rms/user',
} as const;

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.ACCESS_TOKEN, accessToken);
    await AsyncStorage.setItem(KEYS.REFRESH_TOKEN, refreshToken);
  } catch (error) {
    console.error('[tokenStorage] Failed to save tokens:', error);
    throw error;
  }
}

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.ACCESS_TOKEN);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.REFRESH_TOKEN);
}

export async function clearTokens(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.ACCESS_TOKEN);
    await AsyncStorage.removeItem(KEYS.REFRESH_TOKEN);
    await AsyncStorage.removeItem(KEYS.USER);
  } catch (error) {
    console.error('[tokenStorage] Failed to clear tokens:', error);
    // Don't throw - clearing tokens should always succeed
  }
}

export async function saveUser(user: AuthUser): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
  } catch (error) {
    console.error('[tokenStorage] Failed to save user:', error);
    throw error;
  }
}

export async function getStoredUser(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.USER);
    if (!raw) { return null; }
    return JSON.parse(raw) as AuthUser;
  } catch (error) {
    console.error('[tokenStorage] Failed to get stored user:', error);
    return null;
  }
}
