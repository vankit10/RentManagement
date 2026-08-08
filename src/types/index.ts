// ─────────────────────────────────────────────────────────────────────────────
// Adarsh Infra Rent Management System — Shared TypeScript Types
// Matches Firestore data model defined in PRD §10
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
// Firestore Document Interfaces
// ─────────────────────────────────────────────────────────────────────────────

/**
 * users/{userId}
 * Created on registration (tenant) or pre-seeded (owner)
 */
export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  fcmToken?: string;    // updated on each login for push notifications
  createdAt: Date | string;
}

/**
 * tenants/{tenantId}
 * Additional tenant-specific data linked to a UserProfile
 */
export interface Tenant {
  id: string;           // Firestore document ID
  userId: string;       // references users/{userId}
  name: string;         // denormalized for easy listing
  email: string;        // denormalized
  phone: string;        // denormalized
  roomNumber: string;
  joiningDate: Date | string;
  status: TenantStatus;
  rentAmount?: number;  // current configured rent amount
  dueDate?: number;     // day of month (1-31)
}

/**
 * rentRecords/{rentId}
 */
export interface RentRecord {
  id: string;
  tenantId: string;
  month: string;        // e.g. "2026-08" (YYYY-MM)
  amount: number;
  dueDate: Date | string;
  paidDate?: Date | string | null;
  status: RentStatus;
  createdAt: Date | string;
}

/**
 * meterReadings/{readingId}
 */
export interface MeterReading {
  id: string;
  tenantId: string;
  previousReading: number;
  currentReading: number;
  unitsConsumed: number;   // calculated: current - previous
  rate: number;            // ₹ per unit
  amount: number;          // calculated: units × rate
  readingDate: Date | string;
}

/**
 * notifications/{notificationId}
 */
export interface AppNotification {
  id: string;
  tenantId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: Date | string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth Context
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthUser {
  uid: string;
  email: string | null;
  profile: UserProfile | null;
}

export interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Param Lists
// ─────────────────────────────────────────────────────────────────────────────

// Root stack (Auth vs App)
export type RootStackParamList = {
  Auth: undefined;
  TenantApp: undefined;
  OwnerApp: undefined;
};

// Auth stack
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

// Tenant bottom tabs
export type TenantTabParamList = {
  Home: undefined;
  Rent: undefined;
  Electricity: undefined;
  Notifications: undefined;
  Profile: undefined;
};

// Owner bottom tabs
export type OwnerTabParamList = {
  Dashboard: undefined;
  Tenants: undefined;
  Payments: undefined;
  Electricity: undefined;
  Notifications: undefined;
};

// Owner stack (nested inside tab navigator for screens that push)
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
