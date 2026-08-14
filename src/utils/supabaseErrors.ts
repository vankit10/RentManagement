/**
 * Supabase / PostgREST error mapper.
 *
 * Converts raw Supabase database and API errors into user-friendly strings.
 *
 * Error shape from Supabase JS client:
 *   { message: string, code?: string, details?: string, hint?: string }
 *
 * PostgREST error codes use the PostgreSQL SQLSTATE standard (5 chars).
 * Common codes we handle:
 *   23505 — unique_violation
 *   23503 — foreign_key_violation
 *   23502 — not_null_violation
 *   42501 — insufficient_privilege (RLS denied)
 *   PGRST116 — row not found (.single() with no rows)
 *   PGRST301 — JWT expired
 *   PGRST302 — JWT invalid
 *
 * Network / fetch errors come as plain Error with a "network" / "fetch"
 * message — these are also handled here so callers get consistent output
 * regardless of whether the error is DB-level or network-level.
 */

interface SupabaseErrorLike {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Extract a user-friendly message from any Supabase error.
 *
 * @param error     The thrown value — can be a Supabase error object, a
 *                  plain Error, a string, or anything else.
 * @param context   Optional description of the operation, e.g. "loading
 *                  tenants". Included in the generic fallback message.
 */
export function getSupabaseErrorMessage(error: unknown, context?: string): string {
  if (!error) {
    return context
      ? `Something went wrong while ${context}. Please try again.`
      : 'Something went wrong. Please try again.';
  }

  const err = error as SupabaseErrorLike;
  const code = err.code ?? '';
  const rawMsg = (err.message ?? String(error)).toLowerCase();

  // ── PostgREST / SQLSTATE codes ────────────────────────────────────────────

  // Row not found
  if (code === 'PGRST116') {
    return 'Record not found.';
  }

  // Unique constraint violation
  if (code === '23505') {
    if (rawMsg.includes('phone')) {
      return 'This phone number is already registered.';
    }
    if (rawMsg.includes('email')) {
      return 'This email address is already in use.';
    }
    if (rawMsg.includes('tenant_id') && rawMsg.includes('month')) {
      return 'A record for this tenant and month already exists.';
    }
    return 'A duplicate record already exists.';
  }

  // Foreign key violation
  if (code === '23503') {
    return 'This record references data that no longer exists.';
  }

  // Not-null constraint
  if (code === '23502') {
    return 'A required field is missing. Please fill in all required details.';
  }

  // RLS / insufficient privilege
  if (code === '42501' || rawMsg.includes('row-level security') || rawMsg.includes('insufficient privilege')) {
    return 'You do not have permission to perform this action.';
  }

  // JWT token errors
  if (code === 'PGRST301' || rawMsg.includes('jwt expired')) {
    return 'Your session has expired. Please sign in again.';
  }
  if (code === 'PGRST302' || rawMsg.includes('jwt') && rawMsg.includes('invalid')) {
    return 'Invalid session. Please sign in again.';
  }

  // ── Network / connectivity errors ──────────────────────────────────────────
  if (
    rawMsg.includes('network request failed') ||
    rawMsg.includes('failed to fetch') ||
    rawMsg.includes('networkerror') ||
    rawMsg.includes('timeout') ||
    rawMsg.includes('network')
  ) {
    return 'Network error. Please check your connection and try again.';
  }

  // ── Supabase Edge Function errors ─────────────────────────────────────────
  if (rawMsg.includes('function not found') || rawMsg.includes('edge function')) {
    return 'A server function is unavailable. Please try again later.';
  }

  // ── Auth session errors (forwarded from Auth layer) ───────────────────────
  if (rawMsg.includes('not authenticated') || rawMsg.includes('no session')) {
    return 'You must be signed in to do this.';
  }

  // ── Generic fallback ──────────────────────────────────────────────────────
  const fallback = context
    ? `Could not complete: ${context}. Please try again.`
    : 'Something went wrong. Please try again.';
  return fallback;
}

/**
 * Returns true if the error is a "not found" error that callers may want
 * to handle silently (return null) rather than surfacing as an error.
 */
export function isNotFoundError(error: unknown): boolean {
  const code = (error as SupabaseErrorLike)?.code ?? '';
  return code === 'PGRST116';
}

/**
 * Returns true if the error looks like a network/connectivity failure.
 */
export function isNetworkError(error: unknown): boolean {
  const msg = ((error as SupabaseErrorLike)?.message ?? String(error)).toLowerCase();
  return (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('timeout')
  );
}
