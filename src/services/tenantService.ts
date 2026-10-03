/**
 * Tenant Service — Node.js REST API
 * All Supabase calls replaced with Node.js API calls via apiClient.
 */
import api from './apiClient';
import { normalizeRentList } from './rentService';
import type {
  Tenant,
  RentRecord,
  MeterReading,
  AppNotification,
  DashboardStats,
  AccessRequest,
} from '../types';

// ─── Pagination wrapper ───────────────────────────────────────────────────────

interface Paginated<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ─── Tenant profile (tenant-side) ─────────────────────────────────────────────

export async function getTenantByUserId(_userId: string): Promise<Tenant | null> {
  try {
    // Node.js API: GET /tenants/me/profile — returns the tenant for the logged-in user
    const data = await api.get<unknown>('/tenants/me/profile');
    return normalizeTenant(data);
  } catch {
    return null;
  }
}

// ─── Property access requests ────────────────────────────────────────────────

export async function createAccessRequest(ownerEmail: string): Promise<void> {
  await api.post('/access-requests', { ownerEmail });
}

export async function getAccessRequests(): Promise<AccessRequest[]> {
  return api.get<AccessRequest[]>('/access-requests');
}

export async function updateAccessRequest(
  requestId: string,
  status: 'ACCEPTED' | 'REJECTED',
): Promise<AccessRequest> {
  return api.patch<AccessRequest>(`/access-requests/${requestId}/status`, { status });
}

// ─── Owner CRUD ───────────────────────────────────────────────────────────────

export function normalizeTenantList(payload: unknown): Tenant[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const record = payload as Record<string, unknown>;

  if (Array.isArray(record)) {
    return record.map(item => normalizeTenant(item));
  }

  if (record.success === true && record.data && typeof record.data === 'object') {
    const wrapped = record.data as Record<string, unknown>;
    const items = Array.isArray(wrapped.data) ? wrapped.data : Array.isArray(wrapped) ? wrapped : [];
    return items.map(item => normalizeTenant(item));
  }

  if (Array.isArray(record.data)) {
    return record.data.map(item => normalizeTenant(item));
  }

  return [];
}

function normalizeTenant(item: unknown): Tenant {
  const tenant = (item ?? {}) as Record<string, unknown>;
  const statusValue = typeof tenant.status === 'string' ? tenant.status.toLowerCase() : 'active';

  return {
    id: String(tenant.id ?? ''),
    user_id: String((tenant.user_id ?? tenant.userId ?? '')),
    owner_id: typeof (tenant.owner_id ?? tenant.ownerId) === 'string'
      ? String(tenant.owner_id ?? tenant.ownerId)
      : undefined,
    name: String(tenant.name ?? ''),
    email: typeof tenant.email === 'string' ? tenant.email : undefined,
    phone: String(tenant.phone ?? ''),
    room_number: String(tenant.room_number ?? tenant.roomNumber ?? ''),
    joining_date: String(tenant.joining_date ?? tenant.joiningDate ?? new Date().toISOString()),
    status: statusValue === 'inactive' ? 'inactive' : 'active',
    rent_amount: tenant.rent_amount != null || tenant.rentAmount != null
      ? Number(tenant.rent_amount ?? tenant.rentAmount)
      : undefined,
    due_day: tenant.due_day != null || tenant.dueDay != null
      ? Number(tenant.due_day ?? tenant.dueDay)
      : undefined,
    created_at: String(tenant.created_at ?? tenant.createdAt ?? new Date().toISOString()),
  };
}

export async function getAllTenants(): Promise<Tenant[]> {
  const res = await api.get<unknown>('/tenants?limit=100');
  return normalizeTenantList(res);
}

export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  try {
    return normalizeTenant(await api.get<unknown>(`/tenants/${tenantId}`));
  } catch {
    return null;
  }
}

export interface CreateTenantParams {
  name: string;
  phone: string;
  room_number: string;
  joining_date: string;
  rent_amount: number;
  due_day: number;
  email?: string;
}

export interface CreateTenantResult {
  tenantId: string;
  smsSent: boolean;
  smsError?: string;
  authAccountCreated: boolean;
  authAccountError?: string;
  defaultPasswordAssigned: boolean;
  usedExistingAccount: boolean;
}

export async function createTenant(params: CreateTenantParams): Promise<CreateTenantResult> {
  const result = await api.post<{ tenant: Tenant; defaultPasswordAssigned: boolean; usedExistingAccount: boolean }>('/tenants', {
    name: params.name || undefined,
    phone: params.phone || undefined,
    email: params.email || undefined,
    unitId: undefined,
    joiningDate: params.joining_date,
    rentAmount: params.rent_amount > 0 ? params.rent_amount : undefined,
    dueDay: params.due_day,
  });

  return {
    tenantId: result.tenant.id,
    smsSent: false,
    authAccountCreated: !result.usedExistingAccount,
    authAccountError: undefined,
    defaultPasswordAssigned: result.defaultPasswordAssigned,
    usedExistingAccount: result.usedExistingAccount,
  };
}

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
  _userId: string,
  params: UpdateTenantParams,
): Promise<void> {
  await api.put(`/tenants/${tenantId}`, {
    name: params.name,
    joiningDate: params.joining_date,
    rentAmount: params.rent_amount,
    dueDay: params.due_day,
  });
}

export async function deactivateTenant(tenantId: string): Promise<void> {
  await api.patch(`/tenants/${tenantId}/status`, { status: 'INACTIVE' });
}

// ─── Rent records ─────────────────────────────────────────────────────────────

export async function getRentRecords(tenantId: string): Promise<RentRecord[]> {
  const records = await api.get<RentRecord[]>(
    `/rent?tenantId=${tenantId}&limit=100`,
  );
  return records;
}

export async function getLatestRentRecord(tenantId: string): Promise<RentRecord | null> {
  const records = await api.get<RentRecord[]>(
    `/rent?tenantId=${tenantId}&limit=1`,
  );
  return records[0] ?? null;
}

/** Tenant-safe endpoint — the API derives the tenant from the signed-in user. */
export async function getMyRentRecords(): Promise<RentRecord[]> {
  const records = await api.get<unknown[]>('/rent/my?limit=100');
  return normalizeRentList(records);
}

export async function getMyLatestRentRecord(): Promise<RentRecord | null> {
  const records = await api.get<unknown[]>('/rent/my?limit=1');
  return normalizeRentList(records)[0] ?? null;
}

export async function getRentRecordsByTenant(tenantId: string): Promise<RentRecord[]> {
  return getRentRecords(tenantId);
}

// ─── Meter readings ───────────────────────────────────────────────────────────

export async function getMeterReadings(tenantId: string): Promise<MeterReading[]> {
  const res = await api.get<Paginated<MeterReading>>(
    `/electricity?tenantId=${tenantId}&limit=100`,
  );
  return res.data ?? [];
}

export async function getLatestMeterReading(tenantId: string): Promise<MeterReading | null> {
  const res = await api.get<Paginated<MeterReading>>(
    `/electricity?tenantId=${tenantId}&limit=1`,
  );
  return res.data?.[0] ?? null;
}

/** Tenant-safe endpoint — the API derives the tenant from the signed-in user. */
export async function getMyMeterReadings(): Promise<MeterReading[]> {
  return api.get<MeterReading[]>('/electricity/my?limit=100');
}

export async function getMyLatestMeterReading(): Promise<MeterReading | null> {
  const readings = await api.get<MeterReading[]>('/electricity/my?limit=1');
  return readings[0] ?? null;
}

export async function getMeterReadingsByTenant(tenantId: string): Promise<MeterReading[]> {
  return getMeterReadings(tenantId);
}

// ─── Notifications ────────────────────────────────────────────────────────────

export function subscribeToNotifications(
  tenantId: string,
  onData: (notifications: AppNotification[]) => void,
  onError?: (err: Error) => void,
): () => void {
  let active = true;
  let intervalId: ReturnType<typeof setInterval>;

  async function fetchNotifications() {
    try {
      const res = await api.get<Paginated<AppNotification>>(
        `/notifications/my?limit=50`,
      );
      if (active) { onData(res.data ?? []); }
    } catch (err) {
      if (active) { onError?.(err instanceof Error ? err : new Error(String(err))); }
    }
  }

  // Initial fetch
  fetchNotifications();

  // Poll every 30 seconds (replaces Supabase Realtime)
  intervalId = setInterval(fetchNotifications, 30000);

  return () => {
    active = false;
    clearInterval(intervalId);
  };
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await api.patch(`/notifications/${notificationId}/read`);
}

export async function markAllNotificationsRead(_tenantId: string): Promise<void> {
  await api.patch('/notifications/my/read-all');
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const stats = await api.get<{
    totalTenants: number;
    activeTenants: number;
    pendingRent: number;
    overdueRent: number;
    collectedThisMonth: number;
  }>('/tenants/stats');

  return {
    totalTenants: stats.totalTenants,
    activeTenants: stats.activeTenants,
    rentCollected: Number(stats.collectedThisMonth),
    rentPending: stats.pendingRent,
    rentOverdue: stats.overdueRent,
    recentPayments: [],
  };
}

// ─── SMS helpers (no-op — SMS excluded) ──────────────────────────────────────

export async function callSendRentDueSMS(_params: unknown): Promise<{ smsSent: boolean }> {
  return { smsSent: false };
}

export async function callSendPaymentConfirmationSMS(_params: unknown): Promise<{ smsSent: boolean }> {
  return { smsSent: false };
}

// ─── Compatibility stubs (no longer needed with Node.js API) ──────────────────

export async function linkTenantAccountOnFirstLogin(
  _userId: string,
  _phone: string,
): Promise<void> {
  // No-op — handled server-side in Node.js API
}

export async function isTenantPhoneRegistered(_phone: string): Promise<boolean> {
  return false;
}
