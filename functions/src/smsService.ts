/**
 * SMS Service — Twilio
 *
 * Twilio credentials are loaded from Firebase Secret Manager / environment config.
 * They are NEVER exposed to the client app.
 *
 * Usage:
 *   import { sendSms } from './smsService';
 *   await sendSms('+919876543210', 'Your message here');
 */

import * as functions from 'firebase-functions';
import twilio from 'twilio';

// ── Credential resolution ──────────────────────────────────────────────────
// Firebase Functions v2 reads these from Firebase Secret Manager.
// Set them with:
//   firebase functions:secrets:set TWILIO_ACCOUNT_SID
//   firebase functions:secrets:set TWILIO_AUTH_TOKEN
//   firebase functions:secrets:set TWILIO_PHONE_NUMBER
//
// For local development, set them in .env inside the functions/ directory.
// NEVER commit credentials to git.

function getTwilioClient(): twilio.Twilio {
  const accountSid =
    process.env.TWILIO_ACCOUNT_SID ??
    functions.params.defineString('TWILIO_ACCOUNT_SID').value();
  const authToken =
    process.env.TWILIO_AUTH_TOKEN ??
    functions.params.defineString('TWILIO_AUTH_TOKEN').value();

  if (!accountSid || !authToken) {
    throw new Error('[smsService] Twilio credentials not configured.');
  }
  return twilio(accountSid, authToken);
}

function getTwilioPhoneNumber(): string {
  const phone =
    process.env.TWILIO_PHONE_NUMBER ??
    functions.params.defineString('TWILIO_PHONE_NUMBER').value();
  if (!phone) {
    throw new Error('[smsService] TWILIO_PHONE_NUMBER not configured.');
  }
  return phone;
}

// ── Core send function ────────────────────────────────────────────────────

export interface SmsResult {
  success: boolean;
  sid?: string;
  error?: string;
}

/**
 * Send an SMS via Twilio.
 * Returns a result object — never throws to the caller.
 * All errors are logged so they can be retried later.
 */
export async function sendSms(
  toPhone: string,
  body: string,
): Promise<SmsResult> {
  // Normalise to E.164 (prepend +91 if bare 10-digit Indian number)
  const to = toPhone.startsWith('+') ? toPhone : `+91${toPhone}`;

  try {
    const client = getTwilioClient();
    const from = getTwilioPhoneNumber();

    const message = await client.messages.create({ body, from, to });

    functions.logger.info('[smsService] SMS sent', {
      sid: message.sid,
      to,
      status: message.status,
    });

    return { success: true, sid: message.sid };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    functions.logger.error('[smsService] SMS send failed', { to, error: errMsg });
    return { success: false, error: errMsg };
  }
}

// ── Reusable message templates ─────────────────────────────────────────────

/** SMS #1 — Sent when the owner registers a new tenant */
export function tenantRegistrationMessage(tenantName: string): string {
  return (
    `Hi ${tenantName}, you have been registered in the Adarsh Infra Rent Management App. ` +
    `Open the app and login using your mobile number with OTP to view your rent details.`
  );
}

/** SMS #2 — Sent when rent is due */
export function rentDueMessage(
  tenantName: string,
  amount: number,
  dueDate: string,
): string {
  return (
    `Hi ${tenantName}, your rent of Rs.${amount.toLocaleString('en-IN')} is due on ${dueDate}. ` +
    `Please make the payment on time. - Adarsh Infra`
  );
}

/** SMS #3 — Sent when payment is confirmed by owner */
export function paymentConfirmationMessage(
  tenantName: string,
  amount: number,
  month: string,
): string {
  return (
    `Hi ${tenantName}, your rent payment of Rs.${amount.toLocaleString('en-IN')} ` +
    `for ${month} has been recorded. Thank you! - Adarsh Infra`
  );
}
