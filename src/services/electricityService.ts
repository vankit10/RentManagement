/**
 * Electricity Service — Supabase PostgreSQL
 *
 * Meter readings are stored month-wise (one record per tenant per month).
 * A UNIQUE(tenant_id, month) constraint in the database enforces this.
 *
 * The rate is stored per reading so old bills never change when the
 * owner updates the global rate setting.
 *
 * Formula:
 *   Units Consumed = Current Reading - Previous Reading
 *   Electricity Amount = Units Consumed × Rate (₹/unit)
 */
import { supabase } from './supabase';
import type { MeterReading, ElectricitySettings } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Calculation (pure — no database)
// ─────────────────────────────────────────────────────────────────────────────

export function calculateElectricityBill(
  previousReading: number,
  currentReading: number,
  rate: number,
): { unitsConsumed: number; amount: number } {
  const unitsConsumed = Math.max(0, currentReading - previousReading);
  const amount = parseFloat((unitsConsumed * rate).toFixed(2));
  return { unitsConsumed, amount };
}

// ─────────────────────────────────────────────────────────────────────────────
// Electricity settings (global rate)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the global electricity rate setting.
 * There is exactly one row in electricity_settings.
 */
export async function getElectricitySettings(): Promise<ElectricitySettings | null> {
  const { data, error } = await supabase
    .from('electricity_settings')
    .select('*')
    .single();

  if (error) {
    if (error.code === 'PGRST116') { return null; }
    throw error;
  }
  return data as ElectricitySettings;
}

/**
 * Update the global rate per unit.
 * This does NOT recalculate historical bills — each reading stores its own rate.
 */
export async function updateElectricityRate(ratePerUnit: number): Promise<void> {
  // Try update first; if no row exists, insert
  const { data: existing } = await supabase
    .from('electricity_settings')
    .select('id')
    .single();

  if (existing) {
    const { error } = await supabase
      .from('electricity_settings')
      .update({ rate_per_unit: ratePerUnit, updated_at: new Date().toISOString() })
      .eq('id', (existing as { id: string }).id);
    if (error) { throw error; }
  } else {
    const { error } = await supabase
      .from('electricity_settings')
      .insert({ rate_per_unit: ratePerUnit });
    if (error) { throw error; }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────────────────────

export interface AddMeterReadingParams {
  tenantId: string;
  month: string;           // YYYY-MM
  previousReading: number;
  currentReading: number;
  rate: number;
  readingDate: string;     // YYYY-MM-DD
}

/**
 * Add a new meter reading for a tenant.
 *
 * Validates:
 *   - currentReading >= previousReading
 *   - No duplicate reading for the same tenant + month (UNIQUE DB constraint
 *     will also reject it, but we give a friendlier message first)
 *
 * @throws Error with a user-friendly message on validation failure
 */
export async function addMeterReading(
  params: AddMeterReadingParams,
): Promise<string> {
  const { tenantId, month, previousReading, currentReading, rate, readingDate } = params;

  if (currentReading < previousReading) {
    throw new Error('Current reading cannot be less than previous reading.');
  }

  // Friendly duplicate check before hitting the DB constraint
  const { data: dup } = await supabase
    .from('meter_readings')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('month', month)
    .single();

  if (dup) {
    throw new Error(
      `A meter reading for ${month} already exists for this tenant. Delete the existing one to re-enter.`,
    );
  }

  const { unitsConsumed, amount } = calculateElectricityBill(
    previousReading,
    currentReading,
    rate,
  );

  const { data, error } = await supabase
    .from('meter_readings')
    .insert({
      tenant_id: tenantId,
      month,
      previous_reading: previousReading,
      current_reading: currentReading,
      units_consumed: unitsConsumed,
      rate,
      amount,
      reading_date: readingDate,
    })
    .select('id')
    .single();

  if (error) { throw error; }
  return (data as { id: string }).id;
}

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllMeterReadings(): Promise<MeterReading[]> {
  const { data, error } = await supabase
    .from('meter_readings')
    .select('*')
    .order('reading_date', { ascending: false });
  if (error) { throw error; }
  return (data ?? []) as MeterReading[];
}

export async function getMeterReadingsForTenant(
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

/**
 * Get the most recent reading for a tenant.
 * Used to pre-fill previous_reading when adding a new month's reading.
 */
export async function getLatestReadingForTenant(
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

/**
 * Return the most recent reading strictly before the month being entered.
 * This prevents a later reading from being used when an owner adds a
 * historical month out of order.
 */
export async function getLatestReadingBeforeMonth(
  tenantId: string,
  month: string,
): Promise<MeterReading | null> {
  const { data, error } = await supabase
    .from('meter_readings')
    .select('*')
    .eq('tenant_id', tenantId)
    .lt('month', month)
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) { throw error; }
  return data as MeterReading | null;
}

/**
 * Get the reading for a specific tenant + month.
 * Returns null if not yet recorded.
 */
export async function getReadingForMonth(
  tenantId: string,
  month: string,
): Promise<MeterReading | null> {
  const { data, error } = await supabase
    .from('meter_readings')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('month', month)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { return null; }
    throw error;
  }
  return data as MeterReading;
}

/**
 * Check whether a reading already exists for a given tenant + month.
 */
export async function readingExistsForMonth(
  tenantId: string,
  month: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('meter_readings')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('month', month)
    .single();
  return !!data;
}
