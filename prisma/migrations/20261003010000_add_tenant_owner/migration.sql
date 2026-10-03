ALTER TABLE "tenants" ADD COLUMN "owner_id" TEXT;
CREATE INDEX "tenants_owner_id_idx" ON "tenants"("owner_id");
ALTER TABLE "tenants"
  ADD CONSTRAINT "tenants_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
