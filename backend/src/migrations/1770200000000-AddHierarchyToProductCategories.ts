import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHierarchyToProductCategories1770200000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_categories" ADD COLUMN IF NOT EXISTS "parentId" uuid NULL;`,
    );

    await queryRunner.query(
      `ALTER TABLE "product_categories" ADD COLUMN IF NOT EXISTS "isProtected" boolean NOT NULL DEFAULT false;`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_product_categories_parent'
        ) THEN
          ALTER TABLE "product_categories"
          ADD CONSTRAINT "FK_product_categories_parent"
          FOREIGN KEY ("parentId") REFERENCES "product_categories"("id")
          ON DELETE SET NULL;
        END IF;
      END$$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_product_categories_parentId" ON "product_categories" ("parentId");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_categories_parentId";`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_product_categories_parent'
        ) THEN
          ALTER TABLE "product_categories" DROP CONSTRAINT "FK_product_categories_parent";
        END IF;
      END$$;
    `);

    await queryRunner.query(
      `ALTER TABLE "product_categories" DROP COLUMN IF EXISTS "isProtected";`,
    );

    await queryRunner.query(
      `ALTER TABLE "product_categories" DROP COLUMN IF EXISTS "parentId";`,
    );
  }
}
