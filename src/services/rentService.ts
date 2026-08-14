/**
 * Rent Service — Supabase PostgreSQL
 *
 * CRUD for rent_records table.
 * Status values: 'Paid' | 'Pending' | 'Overdue'
 */
import { supabase } from './supabase';
import type { RentRecord, RentStatus } from '../types';
import { format } from 'date-fns';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a YYYY-MM month key from a Date (defaults to today). */
export function toMonthKey(date: Date = new Date()): string {
  return format(date, 'yyyy-MM');
}

/**
 * Build the due-date ISO string for a given month and day-of-month.
 * e.g. month="2026-08", dueDay=5  →  "2026-08-05"
 */
export function buildDueDate(month: string, dueDay: number): string {
  const [y, m] = month.split('-');
  const day = String(dueDay).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateRentRecordParams {
  tenantId: string;
  month: string;    // YYYY-MM
  amount: number;
  dueDay: number;   // 1–28
}

/**
 * Create a new rent record for a given month.
 * Status starts as 'Pending'.
 * If a record already exists for this tenant+month, returns its id unchanged.
 */
export async function createRentRecord(
  params: CreateRentRecordParams,
): Promise<string> {
  const { tenantId, month, amount, dueDay } = params;

  // Guard: check for existing record
  const { data: existing } = await supabase
    .from('rent_records')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('month', month)
    .single();

  if (existing) {
    return (existing as { id: string }).id;
  }

  const due_date = buildDueDate(month, dueDay);

  const { data, error } = await supabase
    .from('rent_records')
    .insert({
      tenant_id: tenantId,
      month,
      amount,
      due_date,
      paid_date: null,
      status: 'Pending' as RentStatus,
    })
    .select('id')
    .single();

  if (error) { throw error; }
  return (data as { id: string }).id;
}

// ─────────────────────────────────────────────────────────────────────────────
// Record payment (mark Paid)
// ─────────────────────────────────────────────────────────────────────────────

export async function recordPayment(
  rentRecordId: string,
  paidDate: string = new Date().toISOString().slice(0, 10),
): Promise<void> {
  const { error } = await supabase
    .from('rent_records')
    .update({ status: 'Paid' as RentStatus, paid_date: paidDate })
    .eq('id', rentRecordId);
  if (error) { throw error; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update status
// ─────────────────────────────────────────────────────────────────────────────

export async function updateRentStatus(
  rentRecordId: string,
  status: RentStatus,
): Promise<void> {
  const { error } = await supabase
    .from('rent_records')
    .update({ status })
    .eq('id', rentRecordId);
  if (error) { throw error; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllRentRecords(): Promise<RentRecord[]> {
  const { data, error } = await supabase
    .from('rent_records')
    .select('*')
    .order('due_date', { ascending: false });
  if (error) { throw error; }
  return (data ?? []) as RentRecord[];
}

export async function getRentRecordsForTenant(
  tenantId: string,
): Promise<RentRecord[]> {
  const { data, error } = await supabase
    .from('rent_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('due_date', { ascending: false });
  if (error) { throw error; }
  return (data ?? []) as RentRecord[];
}

export async function getRentRecordsByStatus(
  status: RentStatus,
): Promise<RentRecord[]> {
  const { data, error } = await supabase
    .from('rent_records')
    .select('*')
    .eq('status', status)
    .order('due_date', { ascending: false });
  if (error) { throw error; }
  return (data ?? []) as RentRecord[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Overdue detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scan all Pending records whose due_date is before today and mark them Overdue.
 * Returns the number of records updated.
 */
export async function detectAndMarkOverdue(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const { data, error } = await supabase
    .from('rent_records')
    .update({ status: 'Overdue' as RentStatus })
    .eq('status', 'Pending')
    .lt('due_date', today)
    .select('id');

  if (error) { throw error; }
  return (data ?? []).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk month generation (owner utility)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate the current month's rent record for every active tenant
 * that has a configured rent_amount and due_day.
 * Skips tenants that already have a record for this month.
 * Returns the count of newly created records.
 * Throws if the initial tenant query fails. Individual insert failures
 * are collected and re-thrown as a single aggregated error so the caller
 * knows how many records were created before the failure.
 */
export async function generateCurrentMonthRent(): Promise<number> {
  const currentMonth = toMonthKey();

  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id, rent_amount, due_day')
    .eq('status', 'active')
    .not('rent_amount', 'is', null)
    .not('due_day', 'is', null);

  if (tenantsError) { throw tenantsError; }

  let created = 0;
  const insertErrors: string[] = [];

  await Promise.all(
    (tenants ?? []).map(async (t: { id: string; rent_amount: number; due_day: number }) => {
      // Check if record already exists for this month
      const { data: existing } = await supabase
        .from('rent_records')
        .select('id')
        .eq('tenant_id', t.id)
        .eq('month', currentMonth)
        .single();

      if (existing) { return; }

      const due_date = buildDueDate(currentMonth, t.due_day);
      const { error } = await supabase.from('rent_records').insert({
        tenant_id: t.id,
        month: currentMonth,
        amount: t.rent_amount,
        due_date,
        paid_date: null,
        status: 'Pending' as RentStatus,
      });

      if (error) {
        console.warn('[rentService] generateCurrentMonthRent insert error for tenant', t.id, ':', error.message);
        insertErrors.push(`Tenant ${t.id}: ${error.message}`);
      } else {
        created++;
      }
    }),
  );

  if (insertErrors.length > 0) {
    throw new Error(
      `${created} record(s) created; ${insertErrors.length} failed: ${insertErrors[0]}${insertErrors.length > 1 ? ` (+${insertErrors.length - 1} more)` : ''}`,
    );
  }

  return created;
}
