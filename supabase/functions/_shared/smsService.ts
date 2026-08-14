/**
 * Shared SMS Service — Twilio
 *
 * Used by all three SMS Edge Functions.
 * Twilio credentials are read from Supabase Edge Function secrets:
 *   supabase secrets set TWILIO_ACCOUNT_SID=...
 *   supabase secrets set TWILIO_AUTH_TOKEN=...
 *   supabase secrets set TWILIO_PHONE_NUMBER=...
 *
 * NEVER expose these in React Native code.
 */

export interface SmsResult {
  success: boolean;
  sid?: string;
  error?: string;
}

/**
 * Normalise a phone number to E.164 format for Indian numbers (+91XXXXXXXXXX).
 *
 * Handles these input forms safely:
 *   "9876543210"      → "+919876543210"  (bare 10-digit)
 *   "919876543210"    → "+919876543210"  (12-digit with country code, no +)
 *   "+919876543210"   → "+919876543210"  (already E.164, returned as-is)
 *   "09876543210"     → "+919876543210"  (leading 0 stripped via slice(-10))
 *
 * Clamps to the last 10 digits before prepending +91 to avoid
 * double-country-code issues (e.g. "919876543210" → "+91919876543210" would
 * be wrong; slice(-10) produces "9876543210" → "+919876543210" ✓).
 */
function toE164(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) { return trimmed; }
  const digits = trimmed.replace(/\D/g, '').slice(-10);
  return `+91${digits}`;
}

/**
 * Send an SMS via Twilio REST API.
 * Returns a result object — never throws.
 */
export async function sendSms(
  toPhone: string,
  body: string,
): Promise<SmsResult> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromPhone = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!accountSid || !authToken || !fromPhone) {
    const err = '[smsService] Twilio credentials not configured.';
    console.error(err);
    return { success: false, error: err };
  }

  const to = toE164(toPhone);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const formData = new URLSearchParams();
  formData.append('To', to);
  formData.append('From', fromPhone);
  formData.append('Body', body);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const json = await response.json() as { sid?: string; error_message?: string; message?: string };

    if (!response.ok) {
      const errMsg = json.error_message ?? json.message ?? `HTTP ${response.status}`;
      console.error('[smsService] Twilio error:', errMsg);
      return { success: false, error: errMsg };
    }

    console.log('[smsService] SMS sent', { sid: json.sid, to });
    return { success: true, sid: json.sid };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[smsService] fetch failed:', errMsg);
    return { success: false, error: errMsg };
  }
}

// ── Message templates ─────────────────────────────────────────────────────────

export function tenantRegistrationMessage(tenantName: string): string {
  return (
    `Hi ${tenantName}, you have been registered in the Adarsh Infra Rent Management App. ` +
    `Open the app and login using your mobile number with OTP to view your rent details. - Adarsh Infra`
  );
}

export function rentDueMessage(
  tenantName: string,
  amount: number,
  dueDate: string,
): string {
  return (
    `Hi ${tenantName}, your rent of Rs.${amount.toLocaleString()} is due on ${dueDate}. ` +
    `Please make the payment on time. - Adarsh Infra`
  );
}

export function paymentConfirmationMessage(
  tenantName: string,
  amount: number,
  month: string,
): string {
  return (
    `Hi ${tenantName}, your rent payment of Rs.${amount.toLocaleString()} ` +
    `for ${month} has been recorded. Thank you! - Adarsh Infra`
  );
}
