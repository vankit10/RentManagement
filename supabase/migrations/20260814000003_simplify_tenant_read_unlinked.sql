-- Simplify the policy to avoid JWT claim parsing issues
DROP POLICY IF EXISTS "tenant_read_unlinked" ON tenants;

CREATE POLICY "tenant_read_unlinked"
  ON tenants FOR SELECT
  USING (user_id = '' AND auth.uid() IS NOT NULL);
