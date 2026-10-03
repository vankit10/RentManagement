CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

CREATE TABLE "access_requests" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "access_requests_tenant_id_owner_id_key" ON "access_requests"("tenant_id", "owner_id");
CREATE INDEX "access_requests_owner_id_status_idx" ON "access_requests"("owner_id", "status");

ALTER TABLE "access_requests"
  ADD CONSTRAINT "access_requests_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "access_requests"
  ADD CONSTRAINT "access_requests_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
