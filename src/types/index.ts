// ─────────────────────────────────────────────────────────────────────────────
// Adarsh Infra Rent Management System — Shared TypeScript Types
// Backend: Supabase PostgreSQL (snake_case column names, UUID primary keys)
// ─────────────────────────────────────────────────────────────────────────────

// ── User Roles ────────────────────────────────────────────────────────────────
export type UserRole = 'tenant' | 'owner';

// ── Payment / Rent Status ─────────────────────────────────────────────────────
export type RentStatus = 'Paid' | 'Pending' | 'Overdue';

// ── Notification Types ────────────────────────────────────────────────────────
export type NotificationType =
  | 'rent_reminder'
  | 'overdue_alert'
  | 'electricity_bill'
  | 'payment_confirmation'
  | 'general';

// ── Tenant Status ─────────────────────────────────────────────────────────────
export type TenantStatus = 'active' | 'inactive';

// ─────────────────────────────────────────────────────────────────────────────
// Database Row Interfaces (match Supabase table columns exactly)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * profiles table
 * Mirrors auth.users — created on first login / owner pre-seed.
 * id = auth.users.id (UUID)
 */
export interface UserProfile {
  id: string;          // UUID — matches Supabase auth.users.id
  name: string;
  email?: string;      // optional — OTP-only tenants may have no email
  phone: string;       // E.164 or 10-digit Indian number
  role: UserRole;
  fcm_token?: string;
  created_at: string;
}

/**
 * tenants table
 * Additional tenant-specific data linked to a profiles row.
 */
export interface Tenant {
  id: string;               // UUID
  user_id: string;          // references profiles.id  (empty string until first login)
  name: string;
  email?: string;
  phone: string;            // primary identifier
  room_number: string;
  joining_date: string;     // ISO date YYYY-MM-DD
  status: TenantStatus;
  rent_amount?: number;
  due_day?: number;         // day of month 1–28
  created_at: string;
}

/**
 * phone_tenant_map table
 * Maps phone → tenant_id so we can link the account on first OTP login.
 */
export interface PhoneTenantMap {
  phone: string;            // primary key — 10-digit normalised
  tenant_id: string;
  linked: boolean;
  user_id?: string;
  created_at: string;
}

/**
 * rent_records table
 */
export interface RentRecord {
  id: string;               // UUID
  tenant_id: string;
  month: string;            // YYYY-MM
  amount: number;
  due_date: string;         // ISO date YYYY-MM-DD
  paid_date?: string | null;
  status: RentStatus;
  created_at: string;
}

/**
 * meter_readings table
 * month field enforces one record per tenant per month (UNIQUE constraint).
 */
export interface MeterReading {
  id: string;               // UUID
  tenant_id: string;
  month: string;            // YYYY-MM
  previous_reading: number;
  current_reading: number;
  units_consumed: number;
  rate: number;
  amount: number;
  reading_date: string;     // ISO date YYYY-MM-DD
}

/**
 * electricity_settings table
 * Stores the global default rate per unit.
 * Owner can change it; historical bills store the rate at time of reading.
 */
export interface ElectricitySettings {
  id: string;               // UUID (single row)
  rate_per_unit: number;
  updated_at: string;
}

/**
 * notifications table
 */
export interface AppNotification {
  id: string;               // UUID
  tenant_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
}

/**
 * device_tokens table
 * Stores FCM device tokens per user for push notifications.
 */
export interface DeviceToken {
  id: string;               // UUID
  user_id: string;
  token: string;
  updated_at: string;
}

/**
 * sms_failure_logs table
 * Written by Edge Functions when an SMS fails so the owner can retry.
 */
export interface SmsFailureLog {
  id: string;
  type: 'registration' | 'rent_due' | 'payment_confirmation';
  tenant_name: string;
  tenant_phone: string;
  error: string;
  created_at: string;
  retried: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth Context
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;          // Node.js API user ID (cuid)
  email: string | null;
  phone: string | null;
  profile: UserProfile | null;
}

export interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Non-null when session restoration or profile loading fails silently. */
  authError: string | null;
  logout: () => Promise<void>;
  updateProfile: (changes: Pick<UserProfile, 'name' | 'email' | 'phone'>) => Promise<void>;
  /** Called by login screens after signIn() to update context state. */
  setAuthUser: (user: AuthUser | null) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// OTP / Phone Auth
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Passed from LoginScreen → OTPVerifyScreen.
 * The pending phone is also stored in authService module scope.
 */
export interface OtpSessionParams {
  phone: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Param Lists
// ─────────────────────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Auth: undefined;
  TenantApp: undefined;
  OwnerApp: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  OTPVerify: OtpSessionParams;
  Register: undefined;
  ForgotPassword: undefined;
};

export type TenantTabParamList = {
  Home: undefined;
  Rent: undefined;
  Electricity: undefined;
  Notifications: undefined;
  Profile: undefined;
};

export type OwnerTabParamList = {
  Dashboard: undefined;
  Tenants: undefined;
  Payments: undefined;
  Electricity: undefined;
  Notifications: undefined;
  Profile: undefined;
};

export type OwnerStackParamList = {
  OwnerTabs: undefined;
  TenantDetail: { tenantId: string };
  AddEditTenant: { tenantId?: string };
  RecordPayment: { tenantId: string };
  AddMeterReading: { tenantId: string };
  SendNotification: { tenantId?: string };
};

// ─────────────────────────────────────────────────────────────────────────────
// Utility / UI
// ─────────────────────────────────────────────────────────────────────────────

export interface StatusBadgeProps {
  status: RentStatus;
}

export interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: string;
  color?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner Dashboard Stats
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalTenants: number;
  activeTenants: number;
  rentCollected: number;
  rentPending: number;
  rentOverdue: number;
  recentPayments: (RentRecord & { tenantName: string })[];
}
