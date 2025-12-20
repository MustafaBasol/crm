import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCrmAutomationStaleDealRules1770900003000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "crm_automation_stale_deal_rules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "staleDays" int NOT NULL DEFAULT 30,
        "stageId" uuid,
        "titleTemplate" varchar(220) NOT NULL,
        "dueInDays" int NOT NULL DEFAULT 0,
        "assigneeTarget" varchar(16) NOT NULL DEFAULT 'owner',
        "assigneeUserId" uuid,
        "cooldownDays" int NOT NULL DEFAULT 7,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_auto_stale_tenant" ON "crm_automation_stale_deal_rules" ("tenantId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_auto_stale_stage" ON "crm_automation_stale_deal_rules" ("stageId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_auto_stale_assignee" ON "crm_automation_stale_deal_rules" ("assigneeUserId");`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "crm_automation_stale_deal_rules"
          ADD CONSTRAINT "FK_crm_auto_stale_stage"
          FOREIGN KEY ("stageId")
          REFERENCES "crm_stages"("id")
          ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "crm_automation_stale_deal_rules"
          ADD CONSTRAINT "FK_crm_auto_stale_assignee_user"
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
      `DROP TABLE IF EXISTS "crm_automation_stale_deal_rules";`,
    );
  }
}
