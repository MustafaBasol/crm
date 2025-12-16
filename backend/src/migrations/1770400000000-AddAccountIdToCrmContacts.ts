import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountIdToCrmContacts1770400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "crm_contacts" ADD COLUMN IF NOT EXISTS "accountId" uuid;`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_contacts_account" ON "crm_contacts" ("accountId");`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_crm_contacts_account'
        ) THEN
          ALTER TABLE "crm_contacts"
          ADD CONSTRAINT "FK_crm_contacts_account"
          FOREIGN KEY ("accountId")
          REFERENCES "customers"("id")
          ON DELETE SET NULL;
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "crm_contacts" DROP COLUMN IF EXISTS "accountId";`,
    );
  }
}
