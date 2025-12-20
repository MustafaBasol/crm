import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAutomationSourceToCrmTasks1770900002000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "crm_tasks" ADD COLUMN IF NOT EXISTS "source" varchar(32);`,
    );
    await queryRunner.query(
      `ALTER TABLE "crm_tasks" ADD COLUMN IF NOT EXISTS "sourceRuleId" uuid;`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_tasks_source" ON "crm_tasks" ("source");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_tasks_source_rule" ON "crm_tasks" ("sourceRuleId");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_crm_tasks_source_rule";`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_crm_tasks_source";`);
    await queryRunner.query(
      `ALTER TABLE "crm_tasks" DROP COLUMN IF EXISTS "sourceRuleId";`,
    );
    await queryRunner.query(
      `ALTER TABLE "crm_tasks" DROP COLUMN IF EXISTS "source";`,
    );
  }
}
