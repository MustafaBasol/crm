import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCrmOpportunityProbabilityAndStageHistory1770900000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Opportunity probability (0..1)
    await queryRunner.query(`
      ALTER TABLE "crm_opportunities"
      ADD COLUMN IF NOT EXISTS "probability" decimal(5,4);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "crm_opportunity_stage_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "opportunityId" uuid NOT NULL,
        "fromStageId" uuid,
        "toStageId" uuid NOT NULL,
        "changedByUserId" uuid,
        "changedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_opp_stage_hist_tenant" ON "crm_opportunity_stage_history" ("tenantId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_opp_stage_hist_opp" ON "crm_opportunity_stage_history" ("opportunityId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_opp_stage_hist_changedAt" ON "crm_opportunity_stage_history" ("changedAt");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_opp_stage_hist_toStage" ON "crm_opportunity_stage_history" ("toStageId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_opp_stage_hist_fromStage" ON "crm_opportunity_stage_history" ("fromStageId");`,
    );

    // Best-effort FKs
    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "crm_opportunity_stage_history"
          ADD CONSTRAINT "FK_crm_opp_stage_hist_opportunity"
          FOREIGN KEY ("opportunityId")
          REFERENCES "crm_opportunities"("id")
          ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "crm_opportunity_stage_history"
          ADD CONSTRAINT "FK_crm_opp_stage_hist_from_stage"
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
        ALTER TABLE "crm_opportunity_stage_history"
          ADD CONSTRAINT "FK_crm_opp_stage_hist_to_stage"
          FOREIGN KEY ("toStageId")
          REFERENCES "crm_stages"("id")
          ON DELETE RESTRICT;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "crm_opportunity_stage_history"
          ADD CONSTRAINT "FK_crm_opp_stage_hist_changed_by_user"
          FOREIGN KEY ("changedByUserId")
          REFERENCES "users"("id")
          ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "crm_opportunity_stage_history";`,
    );
    await queryRunner.query(
      `ALTER TABLE "crm_opportunities" DROP COLUMN IF EXISTS "probability";`,
    );
  }
}
