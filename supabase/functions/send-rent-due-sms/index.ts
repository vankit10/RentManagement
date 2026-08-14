/**
 * Edge Function: send-rent-due-sms
 *
 * Called by the owner to remind a tenant that rent is due.
 * Auth: requires owner role.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendSms, rentDueMessage } from '../_shared/smsService.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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

    const { tenantName, tenantPhone, amount, dueDate } = await req.json() as {
      tenantName: string;
      tenantPhone: string;
      amount: number;
      dueDate: string;
    };

    if (!tenantName || !tenantPhone || !amount || !dueDate) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = rentDueMessage(tenantName, amount, dueDate);
    const result = await sendSms(tenantPhone, body);

    if (!result.success) {
      const adminSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      await adminSupabase.from('sms_failure_logs').insert({
        type: 'rent_due',
        tenant_name: tenantName,
        tenant_phone: tenantPhone,
        error: result.error ?? 'Unknown error',
        retried: false,
      });
    }

    return new Response(
      JSON.stringify({ smsSent: result.success, sid: result.sid ?? null, error: result.error ?? null }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[send-rent-due-sms] Unhandled error:', errMsg);
    return new Response(
      JSON.stringify({ smsSent: false, error: errMsg }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
