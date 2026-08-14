/**
 * Supabase client — singleton
 *
 * Initialised once and re-exported for use across all service files.
 * Uses AsyncStorage for session persistence so the user stays logged in
 * across app restarts.
 *
 * IMPORTANT: SUPABASE_URL and SUPABASE_ANON_KEY are public-safe values.
 * They are not secrets — Supabase's Row Level Security policies enforce
 * all authorisation server-side. Never put service-role or secret keys here.
 *
 * Set these in the .env file at the project root:
 *   SUPABASE_URL=https://xxxx.supabase.co
 *   SUPABASE_ANON_KEY=eyJ...
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Persist the session to AsyncStorage so the user stays logged in
    // after the app is closed and reopened.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
