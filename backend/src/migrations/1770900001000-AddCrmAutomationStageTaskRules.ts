import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCrmAutomationStageTaskRules1770900001000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "crm_automation_stage_task_rules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "fromStageId" uuid,
        "toStageId" uuid NOT NULL,
        "titleTemplate" varchar(220) NOT NULL,
        "dueInDays" int NOT NULL DEFAULT 0,
        "assigneeTarget" varchar(16) NOT NULL DEFAULT 'owner',
        "assigneeUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_auto_stage_task_tenant" ON "crm_automation_stage_task_rules" ("tenantId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_auto_stage_task_from" ON "crm_automation_stage_task_rules" ("fromStageId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_auto_stage_task_to" ON "crm_automation_stage_task_rules" ("toStageId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_auto_stage_task_assignee" ON "crm_automation_stage_task_rules" ("assigneeUserId");`,
    );

    // Best-effort foreign keys
    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "crm_automation_stage_task_rules"
          ADD CONSTRAINT "FK_crm_auto_stage_task_to_stage"
          FOREIGN KEY ("toStageId")
          REFERENCES "crm_stages"("id")
          ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "crm_automation_stage_task_rules"
          ADD CONSTRAINT "FK_crm_auto_stage_task_from_stage"
          FOREIGN KEY ("fromStageId")
          REFERENCES "crm_stages"("id")
          ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "crm_automation_stage_task_rules"
          ADD CONSTRAINT "FK_crm_auto_stage_task_assignee_user"
          FOREIGN KEY ("assigneeUserId")
          REFERENCES "users"("id")
          ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "crm_automation_stage_task_rules";`,
    );
  }
}
