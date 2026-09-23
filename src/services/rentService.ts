/**
 * Rent Service — Node.js REST API
 * All Supabase calls replaced with Node.js API calls via apiClient.
 */
import api from './apiClient';
import type { RentRecord, RentStatus } from '../types';
import { format } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface Paginated<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
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
  const res = await api.get<Paginated<RentRecord>>('/rent?limit=100');
  return res.data ?? [];
}

export async function getRentRecordsForTenant(tenantId: string): Promise<RentRecord[]> {
  const res = await api.get<Paginated<RentRecord>>(
    `/rent?tenantId=${tenantId}&limit=100`,
  );
  return res.data ?? [];
}

export async function getRentRecordsByStatus(status: RentStatus): Promise<RentRecord[]> {
  // Map old status format to new API format
  const apiStatus = status === 'Paid' ? 'PAID' : status === 'Pending' ? 'PENDING' : 'OVERDUE';
  const res = await api.get<Paginated<RentRecord>>(
    `/rent?status=${apiStatus}&limit=100`,
  );
  return res.data ?? [];
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
  const existing = await api.get<Paginated<RentRecord>>(
    `/rent?tenantId=${params.tenantId}&month=${params.month}&limit=1`,
  ).catch(() => null);

  if (existing?.data?.[0]) {
    return existing.data[0].id;
  }

  const record = await api.post<RentRecord>('/rent/generate', {
    month: params.month,
  });
  return record.id ?? '';
}

// ─── Record payment ───────────────────────────────────────────────────────────

export async function recordPayment(
  rentRecordId: string,
  paidDate: string = new Date().toISOString().slice(0, 10),
): Promise<void> {
  await api.patch(`/rent/${rentRecordId}/status`, { status: 'PAID' });
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
