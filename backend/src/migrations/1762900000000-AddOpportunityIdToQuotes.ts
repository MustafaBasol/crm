import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOpportunityIdToQuotes1762900000000
  implements MigrationInterface
{
  name = 'AddOpportunityIdToQuotes1762900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "opportunityId" uuid NULL',
    );

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_quotes_opportunityId" ON "quotes" ("opportunityId")',
    );

    // Optional FK (kept defensive): link quotes -> crm_opportunities if table exists.
    // If crm_opportunities doesn't exist yet (rare in dev), the FK creation will be skipped.
    await queryRunner.query(`DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'crm_opportunities'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'quotes_opportunityId_fkey'
    ) THEN
      ALTER TABLE "quotes"
        ADD CONSTRAINT "quotes_opportunityId_fkey"
        FOREIGN KEY ("opportunityId")
        REFERENCES "crm_opportunities"("id")
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quotes_opportunityId_fkey'
  ) THEN
    ALTER TABLE "quotes" DROP CONSTRAINT "quotes_opportunityId_fkey";
  END IF;
END $$;`);

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_quotes_opportunityId"');

    await queryRunner.query(
      'ALTER TABLE "quotes" DROP COLUMN IF EXISTS "opportunityId"',
    );
  }
}
