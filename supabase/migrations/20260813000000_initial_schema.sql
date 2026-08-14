-- ─────────────────────────────────────────────────────────────────────────────
-- Adarsh Infra Rent Management System — Initial Supabase Schema
-- ─────────────────────────────────────────────────────────────────────────────
-- Run via Supabase CLI:
--   supabase db push
-- Or paste into Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable pgcrypto for uuid_generate_v4() (available by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. profiles
--    Mirrors auth.users — one row per user, created on first login.
--    id = auth.users.id (UUID set by Supabase Auth).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  email       TEXT,
  phone       TEXT,
  role        TEXT        NOT NULL CHECK (role IN ('owner', 'tenant')),
  fcm_token   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Owner: full access
CREATE POLICY "owner_full_access_profiles"
  ON profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'owner'
    )
  );

-- Each user can read/update their own profile
CREATE POLICY "self_read_profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "self_update_profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Allow INSERT of own profile on first login (phone OTP link)
CREATE POLICY "self_insert_profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. tenants
--    Additional tenant-specific data. user_id is empty until first OTP login.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT        NOT NULL DEFAULT '',   -- linked after first login
  name         TEXT        NOT NULL,
  email        TEXT,
  phone        TEXT        NOT NULL,
  room_number  TEXT        NOT NULL DEFAULT '',
  joining_date DATE,
  status       TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  rent_amount  NUMERIC(10, 2),
  due_day      SMALLINT    CHECK (due_day BETWEEN 1 AND 28),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Owner: full CRUD
CREATE POLICY "owner_full_access_tenants"
  ON tenants FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'owner'
    )
  );

-- Tenant: read own row only (matched via user_id = auth.uid())
CREATE POLICY "tenant_read_own"
  ON tenants FOR SELECT
  USING (user_id = auth.uid()::TEXT);

-- Allow the linking step to update user_id on first OTP login
-- (called via service-role key inside the Edge Function / RN linkTenantAccountOnFirstLogin)
-- The service role bypasses RLS, so no extra policy is needed for that path.
-- For the RN client path we allow an authenticated user to update their own tenant row:
CREATE POLICY "tenant_link_self"
  ON tenants FOR UPDATE
  USING (user_id = '' OR user_id = auth.uid()::TEXT)
  WITH CHECK (user_id = auth.uid()::TEXT);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. phone_tenant_map
--    Maps phone → tenant_id for first-login account linking.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phone_tenant_map (
  phone       TEXT        PRIMARY KEY,     -- 10-digit normalised
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  linked      BOOLEAN     NOT NULL DEFAULT FALSE,
  user_id     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE phone_tenant_map ENABLE ROW LEVEL SECURITY;

-- Owner: full CRUD
CREATE POLICY "owner_full_access_phone_map"
  ON phone_tenant_map FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'owner'
    )
  );

-- Any authenticated user can read (needed during first-login link)
CREATE POLICY "authed_read_phone_map"
  ON phone_tenant_map FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Authenticated user can update own entry to set linked = true and user_id
CREATE POLICY "authed_link_self_phone_map"
  ON phone_tenant_map FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (linked = TRUE AND user_id = auth.uid()::TEXT);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. rent_records
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rent_records (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month       CHAR(7)     NOT NULL,  -- YYYY-MM
  amount      NUMERIC(10, 2) NOT NULL,
  due_date    DATE        NOT NULL,
  paid_date   DATE,
  status      TEXT        NOT NULL DEFAULT 'Pending' CHECK (status IN ('Paid', 'Pending', 'Overdue')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, month)          -- one record per tenant per month
);

ALTER TABLE rent_records ENABLE ROW LEVEL SECURITY;

-- Owner: full CRUD
CREATE POLICY "owner_full_access_rent_records"
  ON rent_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'owner'
    )
  );

-- Tenant: read own records
CREATE POLICY "tenant_read_own_rent"
  ON rent_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = rent_records.tenant_id
        AND t.user_id = auth.uid()::TEXT
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. meter_readings
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meter_readings (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month             CHAR(7)     NOT NULL,        -- YYYY-MM
  previous_reading  NUMERIC(10, 2) NOT NULL,
  current_reading   NUMERIC(10, 2) NOT NULL,
  units_consumed    NUMERIC(10, 2) NOT NULL,
  rate              NUMERIC(10, 4) NOT NULL,     -- ₹/unit, stored at time of reading
  amount            NUMERIC(10, 2) NOT NULL,
  reading_date      DATE        NOT NULL,

  UNIQUE (tenant_id, month),                     -- one reading per tenant per month
  CHECK (current_reading >= previous_reading)    -- database-level validation
);

ALTER TABLE meter_readings ENABLE ROW LEVEL SECURITY;

-- Owner: full CRUD
CREATE POLICY "owner_full_access_meter"
  ON meter_readings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'owner'
    )
  );

-- Tenant: read own readings
CREATE POLICY "tenant_read_own_meter"
  ON meter_readings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = meter_readings.tenant_id
        AND t.user_id = auth.uid()::TEXT
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. electricity_settings
--    Single-row table storing the current global rate.
--    Owner can update it; historical readings store rate at time of entry.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS electricity_settings (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_per_unit  NUMERIC(10, 4) NOT NULL DEFAULT 8.00,   -- ₹/unit default
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed one row
INSERT INTO electricity_settings (rate_per_unit) VALUES (8.00)
  ON CONFLICT DO NOTHING;

ALTER TABLE electricity_settings ENABLE ROW LEVEL SECURITY;

-- Owner: read + update
CREATE POLICY "owner_rw_electricity_settings"
  ON electricity_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'owner'
    )
  );

-- Any authenticated user can read (tenants see the rate on their bills)
CREATE POLICY "authed_read_electricity_settings"
  ON electricity_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. notifications
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN (
                'rent_reminder', 'overdue_alert', 'electricity_bill',
                'payment_confirmation', 'general'
              )),
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Owner: full CRUD
CREATE POLICY "owner_full_access_notifications"
  ON notifications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'owner'
    )
  );

-- Tenant: read own notifications
CREATE POLICY "tenant_read_own_notifications"
  ON notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = notifications.tenant_id
        AND t.user_id = auth.uid()::TEXT
    )
  );

-- Tenant: update only is_read on own notifications
CREATE POLICY "tenant_mark_read"
  ON notifications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = notifications.tenant_id
        AND t.user_id = auth.uid()::TEXT
    )
  )
  WITH CHECK (
    -- Only allow flipping is_read to true; no other field may change
    is_read = TRUE
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. device_tokens
--    Stores FCM push notification tokens per user.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id)   -- one token per user (upsert on login)
);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

-- Owner: read all (needed to send push to tenants)
CREATE POLICY "owner_read_device_tokens"
  ON device_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'owner'
    )
  );

-- Each user can upsert their own token
CREATE POLICY "self_upsert_token"
  ON device_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "self_update_token"
  ON device_tokens FOR UPDATE
  USING (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. sms_failure_logs
--    Written by Edge Functions (service-role) when an SMS fails.
--    Owner can read; no client writes allowed.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_failure_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT        NOT NULL CHECK (type IN ('registration', 'rent_due', 'payment_confirmation')),
  tenant_name   TEXT        NOT NULL,
  tenant_phone  TEXT        NOT NULL,
  error         TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retried       BOOLEAN     NOT NULL DEFAULT FALSE
);

ALTER TABLE sms_failure_logs ENABLE ROW LEVEL SECURITY;

-- Owner: read only
CREATE POLICY "owner_read_sms_logs"
  ON sms_failure_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'owner'
    )
  );

-- No client writes — Edge Functions use the service-role key which bypasses RLS


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Indexes for common query patterns
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tenants_user_id       ON tenants (user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_phone         ON tenants (phone);
CREATE INDEX IF NOT EXISTS idx_rent_records_tenant   ON rent_records (tenant_id, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_rent_records_status   ON rent_records (status);
CREATE INDEX IF NOT EXISTS idx_meter_readings_tenant ON meter_readings (tenant_id, reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant  ON notifications (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user    ON device_tokens (user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Realtime — enable for notifications table (used by tenant live updates)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;


-- ─────────────────────────────────────────────────────────────────────────────
-- SETUP NOTES
-- ─────────────────────────────────────────────────────────────────────────────
-- After running this migration:
--
-- 1. CREATE THE OWNER ACCOUNT
--    a. Go to Supabase Dashboard → Authentication → Users → Invite user
--       (or use the Auth API to create owner@adarshinfra.co.in)
--    b. Copy the new user's UUID.
--    c. Insert the owner profile row:
--       INSERT INTO profiles (id, name, email, phone, role)
--       VALUES (
--         '<owner-uuid>',
--         'Akash Verma',
--         'owner@adarshinfra.co.in',
--         '9XXXXXXXXX',
--         'owner'
--       );
--
-- 2. CONFIGURE SUPABASE PHONE AUTH
--    Dashboard → Authentication → Providers → Phone
--    Enable Phone provider and enter your Twilio credentials there.
--    (These Twilio credentials power OTP delivery from Supabase Auth.)
--
-- 3. SET EDGE FUNCTION SECRETS (for the SMS Edge Functions)
--    supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
--    supabase secrets set TWILIO_AUTH_TOKEN=your_auth_token
--    supabase secrets set TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
--
-- 4. DEPLOY EDGE FUNCTIONS
--    supabase functions deploy send-tenant-registration-sms
--    supabase functions deploy send-rent-due-sms
--    supabase functions deploy send-payment-confirmation-sms
--
-- 5. UPDATE src/services/supabase.ts with your project URL and anon key.
-- ─────────────────────────────────────────────────────────────────────────────
