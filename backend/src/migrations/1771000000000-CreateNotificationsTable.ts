import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationsTable1771000000000
  implements MigrationInterface
{
  name = 'CreateNotificationsTable1771000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "title" character varying(220) NOT NULL,
        "description" text NOT NULL,
        "type" character varying(24),
        "link" character varying(220),
        "relatedId" character varying(220),
        "i18nTitleKey" character varying(220),
        "i18nDescKey" character varying(220),
        "i18nParams" jsonb,
        "readAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notifications_tenantId" ON "notifications" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notifications_userId" ON "notifications" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notifications_relatedId" ON "notifications" ("relatedId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notifications_readAt" ON "notifications" ("readAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notifications_readAt"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notifications_relatedId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notifications_userId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notifications_tenantId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
  }
}
