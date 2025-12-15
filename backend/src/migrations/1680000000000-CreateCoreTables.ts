import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCoreTables1680000000000 implements MigrationInterface {
  name = 'CreateCoreTables1680000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Required extensions for UUID generation (idempotent)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // tenants (base table used by many other migrations)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenants" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL UNIQUE,
        "slug" varchar NOT NULL UNIQUE,
        "companyName" varchar NULL,
        "taxNumber" varchar NULL,
        "address" varchar NULL,
        "phone" varchar NULL,
        "email" varchar NULL,
        "subscriptionPlan" varchar NOT NULL DEFAULT 'free',
        "status" varchar NOT NULL DEFAULT 'trial',
        "maxUsers" int NOT NULL DEFAULT 5,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // users
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar NOT NULL UNIQUE,
        "password" varchar NOT NULL,
        "firstName" varchar NOT NULL,
        "lastName" varchar NOT NULL,
        "role" varchar NOT NULL DEFAULT 'user',
        "isActive" boolean NOT NULL DEFAULT true,
        "lastLoginAt" TIMESTAMP NULL,
        "tenantId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_users_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
      );
    `);

    // customers
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customers" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "email" varchar NULL,
        "phone" varchar NULL,
        "address" text NULL,
        "taxNumber" varchar NULL,
        "company" varchar NULL,
        "balance" decimal(15,2) NOT NULL DEFAULT 0,
        "tenantId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_customers_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
      );
    `);

    // suppliers
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "suppliers" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "email" varchar NULL,
        "phone" varchar NULL,
        "address" text NULL,
        "taxNumber" varchar NULL,
        "company" varchar NULL,
        "balance" decimal(15,2) NOT NULL DEFAULT 0,
        "tenantId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_suppliers_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
      );
    `);

    // products
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "products" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "code" varchar NOT NULL,
        "description" text NULL,
        "price" decimal(15,2) NOT NULL,
        "cost" decimal(15,2) NULL,
        "stock" decimal(10,2) NOT NULL DEFAULT 0,
        "minStock" decimal(10,2) NOT NULL DEFAULT 0,
        "unit" varchar NOT NULL DEFAULT 'pieces',
        "category" varchar NULL,
        "barcode" varchar NULL,
        "taxRate" decimal(5,2) NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "tenantId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_products_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
      );
    `);

    // invoices (soft-delete columns added by later migration)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoices" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "invoiceNumber" varchar NOT NULL,
        "tenantId" uuid NOT NULL,
        "customerId" uuid NULL,
        "issueDate" date NOT NULL,
        "dueDate" date NOT NULL,
        "subtotal" decimal(10,2) NOT NULL,
        "taxAmount" decimal(10,2) NOT NULL DEFAULT 0,
        "discountAmount" decimal(10,2) NOT NULL DEFAULT 0,
        "total" decimal(10,2) NOT NULL,
        "status" varchar NOT NULL DEFAULT 'draft',
        "notes" text NULL,
        "saleId" varchar NULL,
        "type" varchar NULL,
        "refundedInvoiceId" uuid NULL,
        "items" jsonb NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_invoices_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_invoices_customer" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_invoices_refunded" FOREIGN KEY ("refundedInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL
      );
    `);

    // expenses (soft-delete columns added by later migration)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "expenses" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "expenseNumber" varchar NOT NULL,
        "tenantId" uuid NOT NULL,
        "supplierId" uuid NULL,
        "description" varchar NOT NULL,
        "expenseDate" date NOT NULL,
        "amount" decimal(10,2) NOT NULL,
        "category" varchar NOT NULL DEFAULT 'other',
        "status" varchar NOT NULL DEFAULT 'pending',
        "notes" text NULL,
        "receiptUrl" varchar NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_expenses_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_expenses_supplier" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL
      );
    `);

    // crm_tasks (accountId added by later migration)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "crm_tasks" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "title" varchar(220) NOT NULL,
        "opportunityId" uuid NULL,
        "dueAt" varchar(48) NULL,
        "completed" boolean NOT NULL DEFAULT false,
        "assigneeUserId" uuid NULL,
        "createdByUserId" uuid NOT NULL,
        "updatedByUserId" uuid NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_crm_tasks_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_crm_tasks_assignee" FOREIGN KEY ("assigneeUserId") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_crm_tasks_created_by" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_crm_tasks_updated_by" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_tasks_tenant" ON "crm_tasks" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_tasks_opportunity" ON "crm_tasks" ("opportunityId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_tasks_assignee" ON "crm_tasks" ("assigneeUserId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crm_tasks_created_by" ON "crm_tasks" ("createdByUserId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_tasks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "expenses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "suppliers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenants"`);
  }
}
