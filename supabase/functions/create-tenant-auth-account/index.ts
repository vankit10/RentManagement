/**
 * Edge Function: create-tenant-auth-account
 *
 * Called by React Native (owner only) when registering a tenant with an
 * optional email + password so the tenant can log in without OTP.
 *
 * Uses the Supabase Admin SDK (service role key) to create the auth user
 * server-side. Credentials are NEVER passed through client-side code.
 *
 * Auth: requires the caller to be the owner (verified via Supabase JWT + role check).
 *
 * Request body:
 *   { email?: string, password: string, phone: string, name: string, tenantId: string }
 *
 * Response:
 *   { authUserId: string }  on success
 *   { error: string }       on failure
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

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
    // ── Verify caller is authenticated owner ───────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const anonSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await anonSupabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check owner role
    const { data: profile } = await anonSupabase
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

    // ── Parse request body ─────────────────────────────────────────────────
    const { email, password, phone, name, tenantId } = await req.json() as {
      email: string;
      password: string;
      phone: string;
      name: string;
      tenantId: string;
    };

    if (!password || !phone || !name || !tenantId) {
      return new Response(
        JSON.stringify({ error: 'password, phone, name and tenantId are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Use admin SDK to create the auth user ──────────────────────────────
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // A password account always has an auth email. When the owner has not
    // supplied a real email, use the same stable phone-derived address used by
    // signInWithPhone() so mobile-number + password login works.
    const normalizedPhone = phone.replace(/^\+91/, '').replace(/\D/g, '').slice(0, 10);
    const loginEmail = email?.trim().toLowerCase()
      || `${normalizedPhone}@tenant.adarshinfra.internal`;

    const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,   // skip email verification — owner is doing the setup
      user_metadata: { name, phone },
    });

    if (createError || !newUser.user) {
      console.error('[create-tenant-auth-account] createUser error:', createError?.message);
      return new Response(
        JSON.stringify({ error: createError?.message ?? 'Failed to create auth user.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const authUserId = newUser.user.id;

    // ── Create the profiles row ────────────────────────────────────────────
    // Use the admin client so RLS doesn't interfere.
    // This is the authoritative profile creation path for email+password tenants.
    const { error: profileError } = await adminSupabase.from('profiles').upsert({
      id: authUserId,
      name,
      email: email?.trim().toLowerCase() || null,
      phone,
      role: 'tenant',
    });

    if (profileError) {
      // Profile creation failed — roll back by deleting the auth user so the
      // owner can retry cleanly.  AuthContext cannot recover from this because
      // the auth user exists but has no profile, leaving the tenant stuck.
      console.error('[create-tenant-auth-account] profiles upsert error:', profileError.message);
      await adminSupabase.auth.admin.deleteUser(authUserId).catch(() => {});
      return new Response(
        JSON.stringify({ error: `Profile creation failed: ${profileError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Link tenants row to the new auth user ──────────────────────────────
    const { error: linkError } = await adminSupabase
      .from('tenants')
      .update({ user_id: authUserId })
      .eq('id', tenantId);

    if (linkError) {
      console.error('[create-tenant-auth-account] tenants link error:', linkError.message);
      // Non-fatal — linkTenantAccountOnFirstLogin will re-link on first login
    }

    // ── Mark phone_tenant_map as linked ────────────────────────────────────
    // Only mark linked=true after the profile row is confirmed to exist.
    const { error: mapLinkError } = await adminSupabase
      .from('phone_tenant_map')
      .update({ linked: true, user_id: authUserId })
      .eq('tenant_id', tenantId);

    if (mapLinkError) {
      console.error('[create-tenant-auth-account] phone_tenant_map update error:', mapLinkError.message);
      // Non-fatal — linkTenantAccountOnFirstLogin will update it on first login
    }

    return new Response(
      JSON.stringify({ authUserId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[create-tenant-auth-account] Unhandled error:', errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
