import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCrmAutomationStageSequenceRules1770900005000
  implements MigrationInterface
{
  name = 'AddCrmAutomationStageSequenceRules1770900005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "crm_automation_stage_sequence_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "fromStageId" uuid,
        "toStageId" uuid NOT NULL,
        "items" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "assigneeTarget" character varying(16) NOT NULL DEFAULT 'owner',
        "assigneeUserId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_crm_automation_stage_sequence_rules" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_crm_automation_stage_sequence_rules_tenantId" ON "crm_automation_stage_sequence_rules" ("tenantId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_crm_automation_stage_sequence_rules_toStageId" ON "crm_automation_stage_sequence_rules" ("toStageId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_crm_automation_stage_sequence_rules_assigneeUserId" ON "crm_automation_stage_sequence_rules" ("assigneeUserId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "crm_automation_stage_sequence_rules"`,
    );
  }
}
