/**
 * Tenant Service — Supabase PostgreSQL
 *
 * All reads/writes go through the Supabase client.
 * Row Level Security policies in the database enforce authorisation.
 * Service files contain no auth logic — just data access.
 *
 * SMS is sent via Supabase Edge Functions, never called directly from RN.
 */
import { supabase } from './supabase';
import type {
  Tenant,
  RentRecord,
  MeterReading,
  AppNotification,
  DashboardStats,
} from '../types';

let notificationChannelSequence = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Phone normalisation helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip any country code and non-digit characters, returning a bare 10-digit
 * Indian mobile number for storage in Supabase.
 *
 * Examples:
 *   "9876543210"    → "9876543210"  (bare 10-digit, unchanged)
 *   "+919876543210" → "9876543210"  (+91 prefix stripped)
 *   "919876543210"  → "9876543210"  (12-digit without +, slice(-10) applied)
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Slice to last 10 digits handles both "9876543210" and "919876543210"
  return digits.slice(-10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tenant profile (tenant-side reads)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the tenant row whose user_id matches the logged-in user's UUID.
 */
export async function getTenantByUserId(userId: string): Promise<Tenant | null> {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { return null; } // no rows
    throw error;
  }
  return data as Tenant;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rent records
// ─────────────────────────────────────────────────────────────────────────────

export async function getRentRecords(tenantId: string): Promise<RentRecord[]> {
  const { data, error } = await supabase
    .from('rent_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('due_date', { ascending: false });

  if (error) { throw error; }
  return (data ?? []) as RentRecord[];
}

export async function getLatestRentRecord(
  tenantId: string,
): Promise<RentRecord | null> {
  const { data, error } = await supabase
    .from('rent_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('due_date', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { return null; }
    throw error;
  }
  return data as RentRecord;
}

// ─────────────────────────────────────────────────────────────────────────────
// Meter readings / electricity
// ─────────────────────────────────────────────────────────────────────────────

export async function getMeterReadings(
  tenantId: string,
): Promise<MeterReading[]> {
  const { data, error } = await supabase
    .from('meter_readings')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('reading_date', { ascending: false });

  if (error) { throw error; }
  return (data ?? []) as MeterReading[];
}

export async function getLatestMeterReading(
  tenantId: string,
): Promise<MeterReading | null> {
  const { data, error } = await supabase
    .from('meter_readings')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('reading_date', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { return null; }
    throw error;
  }
  return data as MeterReading;
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications (tenant)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subscribe to notifications for a tenant using Supabase Realtime.
 * Returns an unsubscribe function (mirrors the old Firestore onSnapshot API).
 */
export function subscribeToNotifications(
  tenantId: string,
  onData: (notifications: AppNotification[]) => void,
  onError?: (err: Error) => void,
): () => void {
  // Initial fetch
  supabase
    .from('notifications')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .then(({ data, error }) => {
      if (error) { onError?.(new Error(error.message)); return; }
      onData((data ?? []) as AppNotification[]);
    });

  // Real-time subscription
  const channel = supabase
    // Dashboard and Notifications can subscribe at the same time. Each needs
    // its own channel instance; reusing the name causes realtime-js to attempt
    // to add a callback after the existing channel has subscribed.
    .channel(`notifications:${tenantId}:${++notificationChannelSequence}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `tenant_id=eq.${tenantId}`,
      },
      async () => {
        // Re-fetch the full list on any change
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error) { onError?.(new Error(error.message)); return; }
        onData((data ?? []) as AppNotification[]);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function markNotificationRead(
  notificationId: string,
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
  if (error) { throw error; }
}

export async function markAllNotificationsRead(
  tenantId: string,
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('tenant_id', tenantId)
    .eq('is_read', false);
  if (error) { throw error; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllTenants(): Promise<Tenant[]> {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .order('name', { ascending: true });

  if (error) { throw error; }
  return (data ?? []) as Tenant[];
}

export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { return null; }
    throw error;
  }
  return data as Tenant;
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Tenant (owner-only)
//
// Flow:
//  1. Write tenants row with user_id = '' (filled on first OTP login).
//  2. Write phone_tenant_map row with linked = false.
//  3. Call Supabase Edge Function to send registration SMS via Twilio.
//     SMS failure does NOT block tenant creation.
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateTenantParams {
  name: string;
  phone: string;           // 10-digit Indian mobile number
  room_number: string;
  joining_date: string;    // ISO YYYY-MM-DD
  rent_amount: number;
  due_day: number;         // day of month 1–28
  // Password enables password login using the tenant's mobile number.  Email
  // is optional; when supplied it can also be used as the login identifier.
  // The auth user is created server-side so credentials never pass through
  // client-side code.
  email?: string;
  password?: string;
}

export interface CreateTenantResult {
  tenantId: string;
  smsSent: boolean;
  smsError?: string;
  authAccountCreated: boolean;
  authAccountError?: string;
}

export async function createTenant(
  params: CreateTenantParams,
): Promise<CreateTenantResult> {
  const { name, phone, room_number, joining_date, rent_amount, due_day, email, password } = params;
  const normalizedPhone = normalizePhone(phone);

  // 1. Write tenants row
  const { data: tenantData, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      user_id: '',
      name,
      phone: normalizedPhone,
      email: email?.trim().toLowerCase() ?? null,
      room_number,
      joining_date,
      status: 'active',
      rent_amount,
      due_day,
    })
    .select('id')
    .single();

  if (tenantError) { throw tenantError; }
  const tenantId = (tenantData as { id: string }).id;

  // 2. Write phone_tenant_map
  const { error: mapError } = await supabase
    .from('phone_tenant_map')
    .upsert({
      phone: normalizedPhone,
      tenant_id: tenantId,
      linked: false,
    });

  if (mapError) {
    // Without this mapping an OTP tenant can authenticate with Supabase but
    // cannot be linked to their tenant/profile record.
    await supabase.from('tenants').delete().eq('id', tenantId);
    throw mapError;
  }

  // 3. Optionally create the auth account and its profile via Edge Function.
  //    Do not report a successful password registration unless this succeeds:
  //    otherwise the tenant record exists without credentials and every
  //    password attempt appears to be an invalid-id/password error.
  let authAccountCreated = false;
  let authAccountError: string | undefined;
  if (password) {
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        'create-tenant-auth-account',
        {
          body: {
            email: email?.trim().toLowerCase(),
            password,
            phone: normalizedPhone,
            name,
            tenantId,
          },
        },
      );

      if (fnError) {
        authAccountError = fnError.message;
      } else {
        const result = fnData as { authUserId?: string; error?: string };
        if (result.error) {
          authAccountError = result.error;
        } else {
          authAccountCreated = true;
        }
      }
    } catch (err: unknown) {
      authAccountError = err instanceof Error ? err.message : 'Auth account creation failed';
    }

    if (!authAccountCreated) {
      // The tenant account is incomplete. Remove the pre-registration so the
      // owner can correct the details and retry without leaving an unusable
      // tenant behind. phone_tenant_map is removed by its FK cascade.
      const { error: rollbackError } = await supabase
        .from('tenants')
        .delete()
        .eq('id', tenantId);
      if (rollbackError) {
        console.error('[tenantService] failed to roll back tenant:', rollbackError.message);
      }
      throw new Error(`Tenant login setup failed: ${authAccountError ?? 'unknown error'}`);
    }
  }

  // 4. Send registration SMS via Edge Function (non-blocking)
  let smsSent = false;
  let smsError: string | undefined;
  try {
    const { data: fnData, error: fnError } = await supabase.functions.invoke(
      'send-tenant-registration-sms',
      {
        body: { tenantName: name, tenantPhone: normalizedPhone },
      },
    );

    if (fnError) {
      smsError = fnError.message;
    } else {
      smsSent = (fnData as { smsSent?: boolean })?.smsSent ?? false;
      smsError = (fnData as { error?: string })?.error ?? undefined;
    }
  } catch (err: unknown) {
    smsError = err instanceof Error ? err.message : 'SMS call failed';
    console.warn('[tenantService] Registration SMS failed:', smsError);
  }

  return { tenantId, smsSent, smsError, authAccountCreated, authAccountError };
}

// ─────────────────────────────────────────────────────────────────────────────
// Link tenant account on first OTP login
//
// Called by AuthContext after a phone-auth user signs in for the first time.
// Creates the profiles row and links tenants.user_id to the auth UUID.
// ─────────────────────────────────────────────────────────────────────────────

export async function linkTenantAccountOnFirstLogin(
  userId: string,
  phone: string,
): Promise<void> {
  const normalizedPhone = normalizePhone(phone);

  // Look up the phone_tenant_map
  const { data: mapData, error: mapError } = await supabase
    .from('phone_tenant_map')
    .select('tenant_id, linked')
    .eq('phone', normalizedPhone)
    .single();

  if (mapError || !mapData) {
    console.error('[tenantService] phone_tenant_map fetch failed:', mapError);
    throw new Error('TENANT_NOT_REGISTERED');
  }

  const { tenant_id } = mapData as { tenant_id: string; linked: boolean };

  // Fetch the tenant's details for the profile.
  // We do this unconditionally — even if linked=true the profile row may be
  // missing due to a partial previous run (e.g. Edge Function profile upsert
  // failed silently).  upsert is idempotent so it is safe to re-run.
  const { data: tenantData, error: tenantFetchError } = await supabase
    .from('tenants')
    .select('name, email, phone')
    .eq('id', tenant_id)
    .single();

  if (tenantFetchError || !tenantData) {
    console.error('[tenantService] tenants fetch failed:', tenantFetchError);
    throw new Error('TENANT_NOT_REGISTERED');
  }

  const { name, email, phone: tenantPhone } = tenantData as {
    name: string;
    email?: string;
    phone: string;
  };

  // Always upsert the profiles row — handles both first-time login and
  // recovery from a prior partial link attempt.
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    name,
    email: email ?? null,
    phone: tenantPhone,
    role: 'tenant',
  });

  if (profileError) { throw profileError; }

  // Link the tenant row to this auth user (no-op if already linked to same uid)
  const { error: tenantUpdateError } = await supabase
    .from('tenants')
    .update({ user_id: userId })
    .eq('id', tenant_id);

  if (tenantUpdateError) { throw tenantUpdateError; }

  // Mark the map entry as linked
  const { error: mapUpdateError } = await supabase
    .from('phone_tenant_map')
    .update({ linked: true, user_id: userId })
    .eq('phone', normalizedPhone);

  if (mapUpdateError) { throw mapUpdateError; }
}

/**
 * Check whether a phone number is registered as a tenant by the owner.
 */
export async function isTenantPhoneRegistered(phone: string): Promise<boolean> {
  const normalizedPhone = normalizePhone(phone);
  const { data } = await supabase
    .from('phone_tenant_map')
    .select('phone')
    .eq('phone', normalizedPhone)
    .single();
  return !!data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Update / Deactivate
// ─────────────────────────────────────────────────────────────────────────────

export interface UpdateTenantParams {
  name?: string;
  room_number?: string;
  joining_date?: string;
  rent_amount?: number;
  due_day?: number;
  status?: 'active' | 'inactive';
}

export async function updateTenant(
  tenantId: string,
  userId: string,
  params: UpdateTenantParams,
): Promise<void> {
  const { error: tenantError } = await supabase
    .from('tenants')
    .update(params)
    .eq('id', tenantId);
  if (tenantError) { throw tenantError; }

  // Mirror name change to profiles if present
  if (params.name && userId) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ name: params.name })
      .eq('id', userId);
    if (profileError) {
      console.warn('[tenantService] profile name sync failed:', profileError.message);
    }
  }
}

export async function deactivateTenant(tenantId: string): Promise<void> {
  const { error } = await supabase
    .from('tenants')
    .update({ status: 'inactive' })
    .eq('id', tenantId);
  if (error) { throw error; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner-scoped helpers (re-export with tenant-id filtering)
// ─────────────────────────────────────────────────────────────────────────────

export async function getRentRecordsByTenant(
  tenantId: string,
): Promise<RentRecord[]> {
  return getRentRecords(tenantId);
}

export async function getMeterReadingsByTenant(
  tenantId: string,
): Promise<MeterReading[]> {
  return getMeterReadings(tenantId);
}

// ─────────────────────────────────────────────────────────────────────────────
// SMS helpers (owner-triggered via Edge Functions)
// ─────────────────────────────────────────────────────────────────────────────

export async function callSendRentDueSMS(params: {
  tenantName: string;
  tenantPhone: string;
  amount: number;
  dueDate: string;
}): Promise<{ smsSent: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-rent-due-sms', {
      body: params,
    });
    if (error) { return { smsSent: false, error: error.message }; }
    return {
      smsSent: (data as { smsSent?: boolean })?.smsSent ?? false,
      error: (data as { error?: string })?.error ?? undefined,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'SMS call failed';
    console.warn('[tenantService] sendRentDueSMS failed:', errMsg);
    return { smsSent: false, error: errMsg };
  }
}

export async function callSendPaymentConfirmationSMS(params: {
  tenantName: string;
  tenantPhone: string;
  amount: number;
  month: string;
}): Promise<{ smsSent: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke(
      'send-payment-confirmation-sms',
      { body: params },
    );
    if (error) { return { smsSent: false, error: error.message }; }
    return {
      smsSent: (data as { smsSent?: boolean })?.smsSent ?? false,
      error: (data as { error?: string })?.error ?? undefined,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'SMS call failed';
    console.warn('[tenantService] sendPaymentConfirmationSMS failed:', errMsg);
    return { smsSent: false, error: errMsg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner dashboard stats
// ─────────────────────────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const [tenantsResult, rentResult] = await Promise.all([
    supabase.from('tenants').select('id, status'),
    supabase
      .from('rent_records')
      .select('id, tenant_id, amount, status, paid_date')
      .order('paid_date', { ascending: false }),
  ]);

  if (tenantsResult.error) { throw tenantsResult.error; }
  if (rentResult.error) { throw rentResult.error; }

  const tenants = tenantsResult.data ?? [];
  const rentRecords = rentResult.data ?? [];

  const totalTenants = tenants.length;
  const activeTenants = tenants.filter(t => t.status === 'active').length;

  const rentCollected = rentRecords
    .filter(r => r.status === 'Paid')
    .reduce((sum, r) => sum + (r.amount ?? 0), 0);

  const rentPending = rentRecords
    .filter(r => r.status === 'Pending')
    .reduce((sum, r) => sum + (r.amount ?? 0), 0);

  const rentOverdue = rentRecords
    .filter(r => r.status === 'Overdue')
    .reduce((sum, r) => sum + (r.amount ?? 0), 0);

  // Fetch tenant names for recent payments display
  const recentPaidRecords = rentRecords
    .filter(r => r.status === 'Paid' && r.paid_date)
    .slice(0, 5);

  const tenantIds = [...new Set(recentPaidRecords.map(r => r.tenant_id))];
  let tenantNameMap: Record<string, string> = {};
  if (tenantIds.length > 0) {
    const { data: tenantNames } = await supabase
      .from('tenants')
      .select('id, name')
      .in('id', tenantIds);
    (tenantNames ?? []).forEach((t: { id: string; name: string }) => {
      tenantNameMap[t.id] = t.name;
    });
  }

  const recentPayments = recentPaidRecords.map(r => ({
    ...(r as unknown as import('../types').RentRecord),
    tenantName: tenantNameMap[r.tenant_id] ?? 'Unknown',
  }));

  return {
    totalTenants,
    activeTenants,
    rentCollected,
    rentPending,
    rentOverdue,
    recentPayments,
  };
}
