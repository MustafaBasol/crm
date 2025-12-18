import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSourceQuoteIdToInvoices1770600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('invoices');
    const hasColumn = table?.findColumnByName('sourceQuoteId');
    if (!hasColumn) {
      await queryRunner.addColumn(
        'invoices',
        new TableColumn({
          name: 'sourceQuoteId',
          type: 'uuid',
          isNullable: true,
        }),
      );
    }

    // PostgreSQL partial unique index: sourceQuoteId NOT NULL
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_invoices_tenant_quote" ON "invoices" ("tenantId", "sourceQuoteId") WHERE "sourceQuoteId" IS NOT NULL;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_invoices_tenant_quote";`);

    const table = await queryRunner.getTable('invoices');
    const hasColumn = table?.findColumnByName('sourceQuoteId');
    if (hasColumn) {
      await queryRunner.dropColumn('invoices', 'sourceQuoteId');
    }
  }
}
