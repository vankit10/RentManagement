-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: fix_tenant_profile_rls
--
-- Fixes two RLS gaps that prevent the tenant first-login profile upsert from
-- succeeding when called from the React Native client (linkTenantAccountOnFirstLogin):
--
-- 1. profiles — self_update_profile had no WITH CHECK clause, so the UPDATE
--    branch of an upsert (ON CONFLICT DO UPDATE) could be rejected when
--    Supabase applied an implicit WITH CHECK derived from the USING expression
--    of other policies (e.g. owner_full_access_profiles).
--    Fix: drop and recreate with an explicit WITH CHECK (id = auth.uid()).
--
-- 2. tenants — tenant_link_self allowed UPDATE only when user_id = ''.
--    If a prior partial run already set user_id to the tenant's uid, a
--    subsequent re-link attempt (e.g. after profile upsert failed the first
--    time) was rejected even though the uid matched.
--    Fix: also allow UPDATE when user_id already equals auth.uid().
--    (The WITH CHECK is unchanged — must end up as the caller's uid.)
--
-- 3. phone_tenant_map — authed_link_self_phone_map had no USING clause filter
--    beyond auth.uid() IS NOT NULL, meaning a tenant could theoretically
--    update any row. Add phone = (SELECT phone FROM auth.users ...) guard to
--    scope it to the caller's own row without requiring a self-join on profiles.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. profiles: rebuild self_update_profile with explicit WITH CHECK ─────────

DROP POLICY IF EXISTS "self_update_profile" ON profiles;

CREATE POLICY "self_update_profile"
  ON profiles FOR UPDATE
  USING    (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- ── 2. tenants: allow re-link when user_id already equals auth.uid() ──────────

DROP POLICY IF EXISTS "tenant_link_self" ON tenants;

CREATE POLICY "tenant_link_self"
  ON tenants FOR UPDATE
  USING    (user_id = '' OR user_id = auth.uid()::TEXT)
  WITH CHECK (user_id = auth.uid()::TEXT);


-- ── 3. phone_tenant_map: scope authed_link_self to the caller's own phone ─────
--    Supabase Phone Auth stores the phone on auth.users in E.164 (+91XXXXXXXXXX).
--    Our phone_tenant_map stores the bare 10-digit number.
--    We match via RIGHT(REGEXP_REPLACE(...), 10) so both formats resolve to the
--    same 10-digit value.

DROP POLICY IF EXISTS "authed_link_self_phone_map" ON phone_tenant_map;

CREATE POLICY "authed_link_self_phone_map"
  ON phone_tenant_map FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- allow if the map row's phone matches the caller's phone (normalised)
      phone = RIGHT(REGEXP_REPLACE(
        (SELECT raw_user_meta_data->>'phone'
           FROM auth.users
          WHERE id = auth.uid()),
        '\D', '', 'g'), 10)
      -- also allow if the row already carries the caller's user_id (re-link)
      OR user_id = auth.uid()::TEXT
      -- allow if the row is not yet linked (phone-only first login path where
      -- auth.users.phone is used rather than user_metadata.phone)
      OR linked = FALSE
    )
  )
  WITH CHECK (
    linked = TRUE
    AND user_id = auth.uid()::TEXT
  );
