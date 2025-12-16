import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureCrmActivitiesAndAddContactId1770300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // CRM activities table was originally created via sqlite synchronize in dev.
    // For Postgres environments we ensure the table exists via migrations.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "crm_activities" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "title" varchar(220) NOT NULL,
        "type" varchar(80) NOT NULL DEFAULT '',
        "accountId" uuid,
        "opportunityId" uuid,
        "dueAt" varchar(48),
        "completed" boolean NOT NULL DEFAULT false,
        "createdByUserId" uuid NOT NULL,
        "updatedByUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(
      `ALTER TABLE "crm_activities" ADD COLUMN IF NOT EXISTS "contactId" uuid;`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_activities_tenant" ON "crm_activities" ("tenantId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_activities_created_by" ON "crm_activities" ("createdByUserId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_activities_account" ON "crm_activities" ("accountId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_activities_opportunity" ON "crm_activities" ("opportunityId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_activities_contact" ON "crm_activities" ("contactId");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "crm_activities" DROP COLUMN IF EXISTS "contactId";`,
    );
  }
}
