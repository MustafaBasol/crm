import { MigrationInterface, QueryRunner } from 'typeorm';

export class QuoteNumberUniquePerTenant1770800000000
  implements MigrationInterface
{
  name = 'QuoteNumberUniquePerTenant1770800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old global unique constraint on quotes.quoteNumber if it exists.
    await queryRunner.query(`DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'quotes'
    AND c.contype = 'u'
    AND array_length(c.conkey, 1) = 1
    AND EXISTS (
      SELECT 1
      FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
      WHERE a.attname = 'quoteNumber'
    )
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "quotes" DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END IF;
END $$;`);

    // Ensure per-tenant uniqueness instead.
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_quotes_tenant_quoteNumber" ON "quotes" ("tenantId", "quoteNumber")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "UQ_quotes_tenant_quoteNumber"',
    );

    // Best-effort restore: recreate the global unique constraint if it doesn't exist.
    await queryRunner.query(`DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'UQ_quotes_quoteNumber'
  ) THEN
    BEGIN
      ALTER TABLE "quotes" ADD CONSTRAINT "UQ_quotes_quoteNumber" UNIQUE ("quoteNumber");
    EXCEPTION WHEN others THEN
      -- ignore
    END;
  END IF;
END $$;`);
  }
}
