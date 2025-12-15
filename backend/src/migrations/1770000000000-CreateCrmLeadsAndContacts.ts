import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCrmLeadsAndContacts1770000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "crm_leads" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" varchar(220) NOT NULL,
        "email" varchar(220),
        "phone" varchar(64),
        "company" varchar(220),
        "status" varchar(64),
        "createdByUserId" uuid NOT NULL,
        "updatedByUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_crm_leads_tenant" ON "crm_leads" ("tenantId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_crm_leads_created_by" ON "crm_leads" ("createdByUserId");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "crm_contacts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" varchar(220) NOT NULL,
        "email" varchar(220),
        "phone" varchar(64),
        "company" varchar(220),
        "createdByUserId" uuid NOT NULL,
        "updatedByUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_crm_contacts_tenant" ON "crm_contacts" ("tenantId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_crm_contacts_created_by" ON "crm_contacts" ("createdByUserId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_contacts";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_leads";`);
  }
}
