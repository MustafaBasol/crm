import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureTenantColumns1770100000000 implements MigrationInterface {
  name = 'EnsureTenantColumns1770100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Keep this migration idempotent; older DBs may already have some of these columns.
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "website" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "currency" varchar(3) NULL DEFAULT 'TRY'`,
    );

    // Türkiye
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "taxOffice" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "mersisNumber" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "kepAddress" varchar NULL`,
    );

    // Fransa
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "siretNumber" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "sirenNumber" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "apeCode" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "tvaNumber" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "rcsNumber" varchar NULL`,
    );

    // Almanya
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "steuernummer" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "umsatzsteuerID" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "handelsregisternummer" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "geschaeftsfuehrer" varchar NULL`,
    );

    // Amerika
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "einNumber" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "taxId" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "businessLicenseNumber" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stateOfIncorporation" varchar NULL`,
    );

    // Subscription / billing
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "subscriptionExpiresAt" TIMESTAMP NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stripeCustomerId" varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "billingInterval" varchar(16) NULL`,
    );

    // Plan downgrade flow
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "downgradePendingUntil" TIMESTAMP NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "requiredUserReduction" int NULL`,
    );

    // JSON settings/features (Tenant entity uses simple-json, store as text)
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "settings" text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "features" text NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "features"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "settings"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "requiredUserReduction"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "downgradePendingUntil"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "billingInterval"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "stripeSubscriptionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "stripeCustomerId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "cancelAtPeriodEnd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "subscriptionExpiresAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "stateOfIncorporation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "businessLicenseNumber"`,
    );
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "taxId"`);
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "einNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "geschaeftsfuehrer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "handelsregisternummer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "umsatzsteuerID"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "steuernummer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "rcsNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "tvaNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "apeCode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "sirenNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "siretNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "kepAddress"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "mersisNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "taxOffice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "currency"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "website"`,
    );
  }
}
