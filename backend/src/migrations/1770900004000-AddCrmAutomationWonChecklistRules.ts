import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCrmAutomationWonChecklistRules1770900004000
  implements MigrationInterface
{
  name = 'AddCrmAutomationWonChecklistRules1770900004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "crm_automation_won_checklist_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "titleTemplates" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "dueInDays" integer NOT NULL DEFAULT 0,
        "assigneeTarget" character varying(16) NOT NULL DEFAULT 'owner',
        "assigneeUserId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_crm_automation_won_checklist_rules" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_crm_automation_won_checklist_rules_tenantId" ON "crm_automation_won_checklist_rules" ("tenantId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_crm_automation_won_checklist_rules_assigneeUserId" ON "crm_automation_won_checklist_rules" ("assigneeUserId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "crm_automation_won_checklist_rules"`,
    );
  }
}
