import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureCrmPipelinesStagesAndOpportunities1770500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "crm_pipelines" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" varchar(120) NOT NULL,
        "isDefault" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_crm_pipelines_tenant_name" ON "crm_pipelines" ("tenantId", "name");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_pipelines_tenant" ON "crm_pipelines" ("tenantId");`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "crm_stages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "pipelineId" uuid NOT NULL,
        "name" varchar(120) NOT NULL,
        "order" int NOT NULL,
        "isClosedWon" boolean NOT NULL DEFAULT false,
        "isClosedLost" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_stages_tenant" ON "crm_stages" ("tenantId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_stages_pipeline" ON "crm_stages" ("pipelineId");`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_crm_stages_tenant_pipeline_order" ON "crm_stages" ("tenantId", "pipelineId", "order");`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_crm_stages_tenant_pipeline_name" ON "crm_stages" ("tenantId", "pipelineId", "name");`,
    );

    // Add FK crm_stages.pipelineId -> crm_pipelines.id (best-effort)
    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "crm_stages"
          ADD CONSTRAINT "FK_crm_stages_pipeline"
          FOREIGN KEY ("pipelineId")
          REFERENCES "crm_pipelines"("id")
          ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "crm_opportunities" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "accountId" uuid NOT NULL,
        "pipelineId" uuid NOT NULL,
        "stageId" uuid NOT NULL,
        "ownerUserId" uuid NOT NULL,
        "name" varchar(180) NOT NULL,
        "amount" decimal(12,2) NOT NULL DEFAULT 0,
        "currency" varchar(3) NOT NULL DEFAULT 'TRY',
        "expectedCloseDate" date,
        "status" varchar(32) NOT NULL DEFAULT 'open',
        "wonAt" timestamptz,
        "lostAt" timestamptz,
        "lostReason" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_opportunities_tenant" ON "crm_opportunities" ("tenantId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_opportunities_account" ON "crm_opportunities" ("accountId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_opportunities_pipeline" ON "crm_opportunities" ("pipelineId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_opportunities_stage" ON "crm_opportunities" ("stageId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_opportunities_owner" ON "crm_opportunities" ("ownerUserId");`,
    );

    // Best-effort FKs for pipeline/stage/account. (ownerUserId FK omitted because entity says SET NULL but column is non-null.)
    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "crm_opportunities"
          ADD CONSTRAINT "FK_crm_opportunities_account"
          FOREIGN KEY ("accountId")
          REFERENCES "customers"("id")
          ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "crm_opportunities"
          ADD CONSTRAINT "FK_crm_opportunities_pipeline"
          FOREIGN KEY ("pipelineId")
          REFERENCES "crm_pipelines"("id")
          ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "crm_opportunities"
          ADD CONSTRAINT "FK_crm_opportunities_stage"
          FOREIGN KEY ("stageId")
          REFERENCES "crm_stages"("id")
          ON DELETE RESTRICT;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "crm_opportunity_members" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "opportunityId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_opportunity_members_tenant" ON "crm_opportunity_members" ("tenantId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_opportunity_members_opportunity" ON "crm_opportunity_members" ("opportunityId");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_opportunity_members_user" ON "crm_opportunity_members" ("userId");`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_crm_opportunity_members_tenant_opp_user" ON "crm_opportunity_members" ("tenantId", "opportunityId", "userId");`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "crm_opportunity_members"
          ADD CONSTRAINT "FK_crm_opp_members_opportunity"
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
        ALTER TABLE "crm_opportunity_members"
          ADD CONSTRAINT "FK_crm_opp_members_user"
          FOREIGN KEY ("userId")
          REFERENCES "users"("id")
          ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Best-effort rollback.
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_opportunity_members";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_opportunities";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_stages";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_pipelines";`);
  }
}
