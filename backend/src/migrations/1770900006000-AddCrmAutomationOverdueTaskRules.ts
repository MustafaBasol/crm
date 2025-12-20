import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCrmAutomationOverdueTaskRules1770900006000
  implements MigrationInterface
{
  name = 'AddCrmAutomationOverdueTaskRules1770900006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "crm_automation_overdue_task_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "overdueDays" integer NOT NULL DEFAULT 1,
        "titleTemplate" character varying(220) NOT NULL,
        "dueInDays" integer NOT NULL DEFAULT 0,
        "assigneeTarget" character varying(16) NOT NULL DEFAULT 'owner',
        "assigneeUserId" uuid,
        "cooldownDays" integer NOT NULL DEFAULT 7,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_crm_automation_overdue_task_rules" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_automation_overdue_task_rules_tenantId" ON "crm_automation_overdue_task_rules" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_automation_overdue_task_rules_assigneeUserId" ON "crm_automation_overdue_task_rules" ("assigneeUserId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_crm_automation_overdue_task_rules_assigneeUserId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_crm_automation_overdue_task_rules_tenantId"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "crm_automation_overdue_task_rules"`,
    );
  }
}
