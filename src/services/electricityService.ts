/**
 * Electricity Service — Node.js REST API
 * All Supabase calls replaced with Node.js API calls via apiClient.
 */
import api from './apiClient';
import type { MeterReading, ElectricitySettings } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface Paginated<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ─── Calculation (pure — no network) ─────────────────────────────────────────

export function calculateElectricityBill(
  previousReading: number,
  currentReading: number,
  rate: number,
): { unitsConsumed: number; amount: number } {
  const unitsConsumed = Math.max(0, currentReading - previousReading);
  const amount = parseFloat((unitsConsumed * rate).toFixed(2));
  return { unitsConsumed, amount };
}

// ─── Electricity settings ─────────────────────────────────────────────────────

export async function getElectricitySettings(): Promise<ElectricitySettings | null> {
  try {
    const data = await api.get<{ id: string; ratePerUnit: number; updatedAt: string }>(
      '/electricity/rate',
    );
    if (!data) { return null; }
    return {
      id: data.id,
      rate_per_unit: Number(data.ratePerUnit),
      updated_at: data.updatedAt,
    };
  } catch {
    return null;
  }
}

export async function updateElectricityRate(ratePerUnit: number): Promise<void> {
  await api.put('/electricity/rate', { ratePerUnit });
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getAllMeterReadings(): Promise<MeterReading[]> {
  const res = await api.get<Paginated<MeterReading>>('/electricity?limit=100');
  return (res.data ?? []).map(mapReading);
}

export async function getMeterReadingsForTenant(tenantId: string): Promise<MeterReading[]> {
  const res = await api.get<Paginated<MeterReading>>(
    `/electricity?tenantId=${tenantId}&limit=100`,
  );
  return (res.data ?? []).map(mapReading);
}

export async function getLatestReadingForTenant(
  tenantId: string,
): Promise<MeterReading | null> {
  const res = await api.get<Paginated<MeterReading>>(
    `/electricity?tenantId=${tenantId}&limit=1`,
  );
  const item = res.data?.[0];
  return item ? mapReading(item) : null;
}

export async function getLatestReadingBeforeMonth(
  tenantId: string,
  month: string,
): Promise<MeterReading | null> {
  const res = await api.get<Paginated<MeterReading>>(
    `/electricity?tenantId=${tenantId}&limit=100`,
  );
  const readings = (res.data ?? [])
    .map(mapReading)
    .filter(r => r.month < month)
    .sort((a, b) => b.month.localeCompare(a.month));
  return readings[0] ?? null;
}

export async function getReadingForMonth(
  tenantId: string,
  month: string,
): Promise<MeterReading | null> {
  const res = await api.get<Paginated<MeterReading>>(
    `/electricity?tenantId=${tenantId}&month=${month}&limit=1`,
  );
  const item = res.data?.[0];
  return item ? mapReading(item) : null;
}

export async function readingExistsForMonth(
  tenantId: string,
  month: string,
): Promise<boolean> {
  const reading = await getReadingForMonth(tenantId, month);
  return reading !== null;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface AddMeterReadingParams {
  tenantId: string;
  month: string;
  previousReading: number;
  currentReading: number;
  rate: number;
  readingDate: string;
}

export async function addMeterReading(params: AddMeterReadingParams): Promise<string> {
  const reading = await api.post<{ id: string }>('/electricity', {
    tenantId: params.tenantId,
    month: params.month,
    previousReading: params.previousReading,
    currentReading: params.currentReading,
    rate: params.rate,
    readingDate: params.readingDate,
  });
  return reading.id;
}

// ─── Map API response to local type ──────────────────────────────────────────
// API returns camelCase; local types use snake_case

function mapReading(r: MeterReading & Record<string, unknown>): MeterReading {
  return {
    id: r.id,
    tenant_id: (r.tenantId as string) ?? r.tenant_id,
    month: r.month,
    previous_reading: Number((r.previousReading as number) ?? r.previous_reading),
    current_reading: Number((r.currentReading as number) ?? r.current_reading),
    units_consumed: Number((r.unitsConsumed as number) ?? r.units_consumed),
    rate: Number(r.rate),
    amount: Number(r.amount),
    reading_date: (r.readingDate as string) ?? r.reading_date,
  };
}
