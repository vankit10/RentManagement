/**
 * Edge Function: send-tenant-registration-sms
 *
 * Called by React Native when the owner registers a new tenant.
 * Sends an SMS via Twilio telling the tenant they have been registered.
 *
 * SMS failure does NOT block tenant registration — always returns 200.
 *
 * Auth: requires the caller to be the owner (verified via Supabase JWT + role check).
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  sendSms,
  tenantRegistrationMessage,
} from '../_shared/smsService.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify caller is authenticated owner
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check owner role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'owner') {
      return new Response(
        JSON.stringify({ error: 'Only the owner can perform this action.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse request body
    const { tenantName, tenantPhone } = await req.json() as {
      tenantName: string;
      tenantPhone: string;
    };

    if (!tenantName || !tenantPhone) {
      return new Response(
        JSON.stringify({ error: 'tenantName and tenantPhone are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Send SMS
    const body = tenantRegistrationMessage(tenantName);
    const result = await sendSms(tenantPhone, body);

    // Log failure so owner can review — uses service role key for admin write
    if (!result.success) {
      const adminSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      await adminSupabase.from('sms_failure_logs').insert({
        type: 'registration',
        tenant_name: tenantName,
        tenant_phone: tenantPhone,
        error: result.error ?? 'Unknown error',
        retried: false,
      });
    }

    // Always 200 — SMS failure must not block tenant registration
    return new Response(
      JSON.stringify({ smsSent: result.success, sid: result.sid ?? null, error: result.error ?? null }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[send-tenant-registration-sms] Unhandled error:', errMsg);
    return new Response(
      JSON.stringify({ smsSent: false, error: errMsg }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
