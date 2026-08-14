-- Add a policy to allow tenants to read their unlinked row during first login
-- They need to read it to get the name/email to create their profiles row.

CREATE POLICY "tenant_read_unlinked"
  ON tenants FOR SELECT
  USING (
    user_id = '' 
    AND phone = RIGHT(REGEXP_REPLACE(COALESCE(auth.jwt()->>'phone', auth.jwt()->'user_metadata'->>'phone', ''), '\D', '', 'g'), 10)
  );
