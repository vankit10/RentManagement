import { format, parseISO, isValid } from 'date-fns';
import type { RentStatus } from '../types';
import Colors from '../constants/colors';

// ─── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Format a date or ISO string to a human-readable string.
 * e.g. "Aug 8, 2026"
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) { return '—'; }
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(d)) { return '—'; }
    return format(d, 'MMM d, yyyy');
  } catch {
    return '—';
  }
}

/**
 * Format to month label. e.g. "August 2026"
 */
export function formatMonth(date: Date | string | null | undefined): string {
  if (!date) { return '—'; }
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(d)) { return '—'; }
    return format(d, 'MMMM yyyy');
  } catch {
    return '—';
  }
}

/**
 * Get current month key in YYYY-MM format.
 */
export function currentMonthKey(): string {
  return format(new Date(), 'yyyy-MM');
}

// ─── Currency helpers ─────────────────────────────────────────────────────────

/**
 * Format a number as Indian Rupee string.
 * e.g. 1360 → "₹1,360"
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) { return '₹0'; }
  return `₹${amount.toLocaleString('en-IN')}`;
}

// ─── Electricity helpers ──────────────────────────────────────────────────────

/**
 * Calculate units consumed and bill amount (PRD §7).
 */
export function calculateElectricity(
  previousReading: number,
  currentReading: number,
  rate: number,
): { unitsConsumed: number; amount: number } {
  const unitsConsumed = Math.max(0, currentReading - previousReading);
  const amount = unitsConsumed * rate;
  return { unitsConsumed, amount };
}

// ─── Status helpers ───────────────────────────────────────────────────────────

/**
 * Get the background and text color for a rent status badge.
 */
export function getStatusColors(status: RentStatus): {
  background: string;
  text: string;
} {
  switch (status) {
    case 'Paid':
      return { background: Colors.successLight, text: Colors.statusPaid };
    case 'Overdue':
      return { background: Colors.errorLight, text: Colors.statusOverdue };
    case 'Pending':
    default:
      return { background: Colors.warningLight, text: Colors.statusPending };
  }
}

// ─── Validation helpers ───────────────────────────────────────────────────────

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone.trim());
}
