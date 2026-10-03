-- Preserve an unpaid balance as part of the following month's rent invoice.
ALTER TYPE "RentStatus" ADD VALUE IF NOT EXISTS 'CARRIED_FORWARD';

ALTER TABLE "rent_records"
  ADD COLUMN IF NOT EXISTS "base_amount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "carried_forward_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Existing invoices had no arrears component, so their original amount is their base rent.
UPDATE "rent_records"
SET "base_amount" = "amount"
WHERE "base_amount" IS NULL;

ALTER TABLE "rent_records"
  ALTER COLUMN "base_amount" SET NOT NULL;
