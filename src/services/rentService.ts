/**
 * Rent Service — Node.js REST API
 * All Supabase calls replaced with Node.js API calls via apiClient.
 */
import api from './apiClient';
import type { RentRecord, RentStatus } from '../types';
import { format } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeStatus(status: unknown): RentStatus {
  const value = String(status ?? 'PENDING').toUpperCase();
  if (value === 'PAID') { return 'Paid'; }
  if (value === 'OVERDUE') { return 'Overdue'; }
  if (value === 'CARRIED_FORWARD') { return 'Carried Forward'; }
  return 'Pending';
}

export function normalizeRentRecord(item: unknown): RentRecord {
  const record = (item ?? {}) as Record<string, unknown>;
  const payments = Array.isArray(record.payments) ? record.payments as Array<Record<string, unknown>> : [];
  const amount = Number(record.amount ?? 0);
  const amountPaid = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  return {
    id: String(record.id ?? ''),
    tenant_id: String(record.tenant_id ?? record.tenantId ?? ''),
    month: String(record.month ?? ''),
    amount,
    base_amount: record.base_amount != null || record.baseAmount != null ? Number(record.base_amount ?? record.baseAmount) : amount,
    carried_forward_amount: Number(record.carried_forward_amount ?? record.carriedForwardAmount ?? 0),
    amount_paid: amountPaid,
    balance: Math.max(0, amount - amountPaid),
    due_date: String(record.due_date ?? record.dueDate ?? ''),
    paid_date: record.paid_date != null || record.paidDate != null ? String(record.paid_date ?? record.paidDate) : null,
    status: normalizeStatus(record.status),
    created_at: String(record.created_at ?? record.createdAt ?? ''),
  };
}

export function normalizeRentList(records: unknown[]): RentRecord[] {
  return records.map(normalizeRentRecord);
}

export function toMonthKey(date: Date = new Date()): string {
  return format(date, 'yyyy-MM');
}

export function buildDueDate(month: string, dueDay: number): string {
  const [y, m] = month.split('-');
  return `${y}-${m}-${String(dueDay).padStart(2, '0')}`;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getAllRentRecords(): Promise<RentRecord[]> {
  const records = await api.get<unknown[]>('/rent?limit=100');
  return normalizeRentList(records);
}

export async function getRentRecordsForTenant(tenantId: string): Promise<RentRecord[]> {
  const records = await api.get<unknown[]>(
    `/rent?tenantId=${tenantId}&limit=100`,
  );
  return normalizeRentList(records);
}

export async function getRentRecordsByStatus(status: RentStatus): Promise<RentRecord[]> {
  // Map old status format to new API format
  const apiStatus = status === 'Paid' ? 'PAID' : status === 'Pending' ? 'PENDING' : 'OVERDUE';
  const records = await api.get<unknown[]>(
    `/rent?status=${apiStatus}&limit=100`,
  );
  return normalizeRentList(records);
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface CreateRentRecordParams {
  tenantId: string;
  month: string;
  amount: number;
  dueDay: number;
}

export async function createRentRecord(params: CreateRentRecordParams): Promise<string> {
  // Check existing first
  const existing = await api.get<unknown[]>(
    `/rent?tenantId=${params.tenantId}&month=${params.month}&limit=1`,
  ).catch(() => null);

  const existingRecord = existing ? normalizeRentList(existing)[0] : undefined;
  if (existingRecord) {
    return existingRecord.id;
  }

  await api.post('/rent/generate', {
    month: params.month,
  });
  const generated = await api.get<unknown[]>(
    `/rent?tenantId=${params.tenantId}&month=${params.month}&limit=1`,
  );
  const record = normalizeRentList(generated)[0];
  if (!record) { throw new Error('Rent record was not created.'); }
  return record.id;
}

// ─── Record payment ───────────────────────────────────────────────────────────

export async function recordPayment(
  rentRecordId: string,
  tenantId: string,
  amount: number,
  paidDate: string = new Date().toISOString().slice(0, 10),
): Promise<void> {
  await api.post('/payments', { tenantId, rentRecordId, amount, paymentDate: paidDate });
}

// ─── Update status ────────────────────────────────────────────────────────────

export async function updateRentStatus(
  rentRecordId: string,
  status: RentStatus,
): Promise<void> {
  const apiStatus = status === 'Paid' ? 'PAID' : status === 'Pending' ? 'PENDING' : 'OVERDUE';
  await api.patch(`/rent/${rentRecordId}/status`, { status: apiStatus });
}

// ─── Generate monthly rent ────────────────────────────────────────────────────

export async function generateCurrentMonthRent(): Promise<number> {
  const result = await api.post<{ created: number; skipped: number; month: string }>(
    '/rent/generate',
    { month: toMonthKey() },
  );
  return result.created;
}

// ─── Overdue detection ────────────────────────────────────────────────────────

export async function detectAndMarkOverdue(): Promise<number> {
  const result = await api.post<{ markedOverdue: number }>('/rent/mark-overdue');
  return result.markedOverdue;
}
