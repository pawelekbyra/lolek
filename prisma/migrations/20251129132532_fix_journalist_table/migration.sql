BEGIN;

-- Step 1: Remove duplicate journalists based on the "contact" column, keeping the first one.
DELETE FROM "Journalist" a USING "Journalist" b
WHERE a.id > b.id AND a.contact = b.contact;

-- Step 2: Drop the old unique index if it exists to avoid conflicts.
DROP INDEX IF EXISTS "Journalist_email_key";

-- Step 3: Add new columns required by the schema.
ALTER TABLE "Journalist"
  ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) NOT NULL DEFAULT 'Nieznany',
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Step 4: Migrate data from old columns to new ones.
-- Move 'category' content to 'notes' and try to extract a name from 'person_role'.
UPDATE "Journalist"
SET
  "notes" = "category",
  "name" = COALESCE(NULLIF(split_part("person_role", ' ', 1), ''), 'Nieznany');

-- Step 5: Rename columns to match the Prisma schema.
ALTER TABLE "Journalist"
  RENAME COLUMN "contact" TO "email";
ALTER TABLE "Journalist"
  RENAME COLUMN "medium" TO "outlet";
ALTER TABLE "Journalist"
  RENAME COLUMN "person_role" TO "role";

-- Step 6: Drop the old, now unused "category" column.
ALTER TABLE "Journalist"
  DROP COLUMN "category";

-- Step 7: Create the unique index on the now-renamed "email" column.
CREATE UNIQUE INDEX "Journalist_email_key" ON "Journalist"("email");

-- Step 8: Create an index on the "outlet" column as defined in the schema.
CREATE INDEX "Journalist_outlet_idx" ON "Journalist"("outlet");

COMMIT;
