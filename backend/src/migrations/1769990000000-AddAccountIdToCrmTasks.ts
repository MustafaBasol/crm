import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountIdToCrmTasks1769990000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "crm_tasks"
      ADD COLUMN IF NOT EXISTS "accountId" uuid;
    `);

    await queryRunner.query(`
      ALTER TABLE "crm_tasks"
      ALTER COLUMN "opportunityId" DROP NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_crm_tasks_account_id"
      ON "crm_tasks" ("accountId");
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_crm_tasks_account'
        ) THEN
          ALTER TABLE "crm_tasks"
          ADD CONSTRAINT "FK_crm_tasks_account"
          FOREIGN KEY ("accountId")
          REFERENCES "customers"("id")
          ON DELETE CASCADE;
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "crm_tasks"
      DROP CONSTRAINT IF EXISTS "FK_crm_tasks_account";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_crm_tasks_account_id";
    `);

    await queryRunner.query(`
      ALTER TABLE "crm_tasks"
      DROP COLUMN IF EXISTS "accountId";
    `);

    await queryRunner.query(`
      ALTER TABLE "crm_tasks"
      ALTER COLUMN "opportunityId" SET NOT NULL;
    `);
  }
}
