import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository, FindOptionsWhere } from 'typeorm';
import type { DeepPartial } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantPlanLimitService } from '../common/tenant-plan-limits.service';
import { Sale, SaleStatus } from '../sales/entities/sale.entity';
import { Product } from '../products/entities/product.entity';
import { ProductCategory } from '../products/entities/product-category.entity';
import { Quote, QuoteStatus } from '../quotes/entities/quote.entity';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  InvoiceLineItemInput,
  InvoiceStatistics,
} from './dto/invoice.dto';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectRepository(Sale)
    private salesRepository: Repository<Sale>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(ProductCategory)
    private categoriesRepository: Repository<ProductCategory>,

    @InjectRepository(Quote)
    private readonly quotesRepository: Repository<Quote>,
  ) {}

  private isUuid(val?: string | null) {
    if (!val) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      val,
    );
  }

  async createFromQuote(tenantId: string, quoteId: string): Promise<Invoice> {
    const qid = String(quoteId || '').trim();
    if (!this.isUuid(qid)) {
      throw new BadRequestException('Invalid quoteId');
    }

    const quote = await this.quotesRepository.findOne({
      where: { tenantId, id: qid },
    });
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.status !== QuoteStatus.ACCEPTED) {
      throw new BadRequestException('Only accepted quotes can be converted');
    }

    const attachSourceQuoteFields = (invoice: Invoice) => {
      (invoice as any).sourceQuoteNumber = quote.quoteNumber
        ? String(quote.quoteNumber)
        : null;
      (invoice as any).sourceOpportunityId = quote.opportunityId
        ? String(quote.opportunityId)
        : null;
      return invoice;
    };

    // Idempotency: if an invoice already exists for this quote, return it.
    const existing = await this.invoicesRepository.findOne({
      where: { tenantId, sourceQuoteId: quote.id },
      relations: ['customer', 'createdByUser', 'updatedByUser'],
    });
    if (existing) {
      return attachSourceQuoteFields(existing);
    }

    const issueDate = quote.issueDate
      ? new Date(quote.issueDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const dueDate = (() => {
      if (quote.validUntil) {
        try {
          return new Date(quote.validUntil).toISOString().slice(0, 10);
        } catch {
          // ignore
        }
      }
      const d = new Date(issueDate);
      d.setDate(d.getDate() + 30);
      return d.toISOString().slice(0, 10);
    })();

    const rawItems = Array.isArray(quote.items) ? quote.items : [];
    const lineItems: InvoiceLineItemInput[] = rawItems
      .filter(Boolean)
      .map((it: any) => {
        const quantity = Math.max(0, Number(it.quantity ?? it.qty ?? 0) || 0);
        const unitPrice = Math.max(
          0,
          Number(it.unitPrice ?? it.price ?? it.unit_price ?? 0) || 0,
        );
        const productId =
          typeof it.productId === 'string' && this.isUuid(it.productId)
            ? it.productId
            : undefined;
        const description =
          (typeof it.description === 'string' && it.description.trim()) ||
          (typeof it.productName === 'string' && it.productName.trim()) ||
          '';

        const taxRate =
          it.taxRate !== undefined &&
          it.taxRate !== null &&
          `${it.taxRate}`.trim() !== ''
            ? Number(it.taxRate)
            : undefined;

        return {
          productId,
          productName: description || undefined,
          description,
          quantity,
          unitPrice,
          taxRate: Number.isFinite(taxRate as number)
            ? (taxRate as number)
            : undefined,
        } as InvoiceLineItemInput;
      });

    const dto: CreateInvoiceDto = {
      customerId: quote.customerId || null,
      issueDate,
      dueDate,
      status: InvoiceStatus.DRAFT,
      notes: quote.quoteNumber
        ? `From quote ${quote.quoteNumber}`
        : 'From quote',
      lineItems,
      sourceQuoteId: quote.id,
    };

    try {
      const created = await this.create(tenantId, dto);
      return attachSourceQuoteFields(created);
    } catch (error) {
      // In case of a race with the unique constraint, return the existing invoice.
      const existingAfter = await this.invoicesRepository.findOne({
        where: { tenantId, sourceQuoteId: quote.id },
        relations: ['customer', 'createdByUser', 'updatedByUser'],
      });
      if (existingAfter) {
        return attachSourceQuoteFields(existingAfter);
      }
      throw error;
    }
  }

  private normalizeTaxRate(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'boolean') {
      return null;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0) {
        return null;
      }
      return Math.round(value * 100) / 100;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      const numeric = Number(trimmed);
      if (!Number.isFinite(numeric) || numeric < 0) {
        return null;
      }
      return Math.round(numeric * 100) / 100;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return null;
    }
    return Math.round(numeric * 100) / 100;
  }

  private logStockUpdateFailure(
    event: string,
    error: unknown,
    level: 'warn' | 'error' = 'warn',
  ) {
    const message = `${event}: ${error instanceof Error ? error.message : String(error)}`;
    const stack = error instanceof Error ? error.stack : undefined;
    if (level === 'error') {
      this.logger.error(message, stack);
      return;
    }
    this.logger.warn(message);
    if (stack) this.logger.debug(stack);
  }

  private async resolveTaxRate(
    tenantId: string,
    item: InvoiceLineItemInput,
  ): Promise<number> {
    // 1) Satırda açıkça taxRate varsa onu kullan (satır bazlı override)
    const lineRate = this.normalizeTaxRate(item?.taxRate);
    if (lineRate !== null) {
      return lineRate;
    }

    // 2) Ürün üzerinden belirle
    if (item?.productId) {
      const product = await this.productsRepository.findOne({
        where: { id: item.productId, tenantId },
      });
      if (product) {
        // 2a) Ürüne özel override tanımlıysa (kategori KDV'sini ezer)
        const override = this.normalizeTaxRate(product.categoryTaxRateOverride);
        if (override !== null) {
          return override;
        }
        // 2b) Kategori adı belirtilmişse önce alt kategori sonra ana kategori KDV'si
        if (product.category) {
          const category = await this.categoriesRepository.findOne({
            where: { name: product.category, tenantId },
          });
          if (category) {
            const catRate = this.normalizeTaxRate(category.taxRate);
            if (catRate !== null) {
              return catRate;
            }
            if (category.parentId) {
              const parent = await this.categoriesRepository.findOne({
                where: { id: category.parentId, tenantId },
              });
              if (parent) {
                const parentRate = this.normalizeTaxRate(parent.taxRate);
                if (parentRate !== null) {
                  return parentRate;
                }
              }
            }
          }
        }
        // 2c) Eski alan: ürün.taxRate (mevcutsa, son çare)
        const productRate = this.normalizeTaxRate(product.taxRate);
        if (productRate !== null) {
          return productRate;
        }
      }
    }

    // 3) Varsayılan: %18
    return 18;
  }

  private buildProductQuantityMap(
    items: InvoiceLineItemInput[] | null | undefined,
  ): Map<string, number> {
    const map = new Map<string, number>();
    if (!Array.isArray(items)) {
      return map;
    }
    for (const item of items) {
      const pid = item?.productId ? String(item.productId) : '';
      if (!pid) {
        continue;
      }
      const qty = Number(item?.quantity) || 0;
      if (!Number.isFinite(qty) || qty === 0) {
        continue;
      }
      map.set(pid, (map.get(pid) || 0) + qty);
    }
    return map;
  }

  private diffProductQuantities(
    previousMap: Map<string, number>,
    nextMap: Map<string, number>,
  ): Map<string, number> {
    const diff = new Map<string, number>();
    const ids = new Set<string>([
      ...Array.from(previousMap.keys()),
      ...Array.from(nextMap.keys()),
    ]);
    for (const pid of ids) {
      const delta = (previousMap.get(pid) || 0) - (nextMap.get(pid) || 0);
      if (delta !== 0) {
        diff.set(pid, delta);
      }
    }
    return diff;
  }

  private async applyStockAdjustments(
    tenantId: string,
    adjustments: Map<string, number>,
    context: 'update' | 'refund' = 'update',
  ): Promise<void> {
    if (!adjustments || adjustments.size === 0) {
      return;
    }
    for (const [productId, delta] of adjustments.entries()) {
      if (!delta) continue;
      try {
        const product = await this.productsRepository.findOne({
          where: { id: productId, tenantId },
        });
        if (!product) continue;
        const currentStock = Number(product.stock || 0);
        const nextStock = currentStock + delta;
        product.stock = nextStock < 0 ? 0 : nextStock;
        await this.productsRepository.save(product);
      } catch (error) {
        this.logStockUpdateFailure(
          `invoices.${context}.stockAdjustFailed`,
          error,
          'error',
        );
      }
    }
  }

  async create(
    tenantId: string,
    createInvoiceDto: CreateInvoiceDto,
  ): Promise<Invoice> {
    // Plan limiti: Aylık fatura sayısı kontrolü
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthCount = await this.invoicesRepository.count({
      where: {
        tenantId,
        isVoided: false,
        createdAt: Between(startOfMonth, now),
      },
    });
    if (
      !TenantPlanLimitService.canAddInvoiceThisMonthForTenant(
        currentMonthCount,
        tenant,
      )
    ) {
      const effective = TenantPlanLimitService.getLimitsForTenant(tenant);
      throw new BadRequestException(
        TenantPlanLimitService.errorMessageForWithLimits('invoice', effective),
      );
    }

    // Generate invoice number if not provided - Format: INV-YYYY-MM-XXX
    let invoiceNumber = createInvoiceDto.invoiceNumber;

    if (!invoiceNumber) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const prefix = `INV-${year}-${month}-`;

      // Find the last invoice number for this month
      const existingInvoices = await this.invoicesRepository.find({
        where: { tenantId },
        order: { invoiceNumber: 'DESC' },
      });

      // Filter invoices from current month and find max sequence
      const currentMonthInvoices = existingInvoices.filter((inv) =>
        inv.invoiceNumber.startsWith(prefix),
      );

      let nextSequence = 1;
      if (currentMonthInvoices.length > 0) {
        // Extract sequence number from last invoice
        const lastInvoiceNumber = currentMonthInvoices[0].invoiceNumber;
        const lastSequence = parseInt(
          lastInvoiceNumber.split('-').pop() || '0',
          10,
        );
        nextSequence = lastSequence + 1;
      }

      invoiceNumber = `${prefix}${String(nextSequence).padStart(3, '0')}`;
    }

    // Calculate total from line items - Her ürün kendi KDV oranıyla
    const rawItems = createInvoiceDto.lineItems ?? createInvoiceDto.items ?? [];
    const items: InvoiceLineItemInput[] = Array.isArray(rawItems)
      ? rawItems
      : [];

    if (process.env.NODE_ENV !== 'test') {
      this.logger.debug(
        `Invoice tax calc start (tenantId=${tenantId}, itemCount=${items.length})`,
      );
    }

    // Her ürün için KDV hesapla (Fiyatlar KDV HARİÇ)
    let subtotal = 0; // KDV HARİÇ toplam
    let taxAmount = 0; // KDV tutarı

    for (const item of items) {
      const itemTotal =
        (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0); // KDV HARİÇ
      const effectiveRate = await this.resolveTaxRate(tenantId, item);
      const itemTaxRate = Number(effectiveRate) / 100; // % => oran
      const itemTax = itemTotal * itemTaxRate; // KDV tutarı

      if (item) {
        item.taxRate = effectiveRate;
      }

      if (process.env.NODE_ENV !== 'test') {
        this.logger.debug(
          `Invoice line (product=${item.productName || item.description || 'n/a'}, qty=${String(
            item.quantity,
          )}, unitPrice=${String(item.unitPrice)}, taxRate=${String(
            effectiveRate,
          )})`,
        );
      }

      subtotal += itemTotal; // KDV HARİÇ toplam
      taxAmount += itemTax; // KDV toplamı
    }

    const discountAmount = Number(createInvoiceDto.discountAmount) || 0;
    const total = subtotal + taxAmount - discountAmount; // KDV DAHİL toplam

    if (process.env.NODE_ENV !== 'test') {
      this.logger.debug(
        `Invoice totals (subtotal=${subtotal}, taxAmount=${taxAmount}, discount=${discountAmount}, total=${total})`,
      );
    }

    const payload: DeepPartial<Invoice> = {
      ...createInvoiceDto,
      tenantId,
      invoiceNumber,
      items,
      subtotal,
      taxAmount,
      discountAmount,
      total,
    };
    const invoice = this.invoicesRepository.create(payload);
    const saved: Invoice = await this.invoicesRepository.save(invoice);
    const savedId = saved.id;

    // Load with customer relation
    const result = await this.invoicesRepository.findOne({
      where: { id: savedId },
      relations: ['customer'],
    });

    if (!result) {
      throw new NotFoundException('Failed to create invoice');
    }

    // Eğer saleId verildiyse satışla ilişkilendir ve satış durumunu güncelle
    try {
      const saleId = createInvoiceDto.saleId ?? undefined;
      if (saleId) {
        const sale = await this.salesRepository.findOne({
          where: { id: saleId, tenantId },
        });
        if (sale) {
          sale.invoiceId = savedId;
          sale.status = SaleStatus.INVOICED;
          await this.salesRepository.save(sale);
        }
      }
    } catch (error) {
      // Sessizce logla; fatura oluşturma başarıyla tamamlandı
      this.logStockUpdateFailure('invoice.linkedSale', error);
    }

    return result;
  }

  async findAll(
    tenantId: string,
  ): Promise<
    Array<
      Invoice & {
        sourceQuoteNumber?: string | null;
        sourceOpportunityId?: string | null;
      }
    >
  > {
    const invoices = await this.invoicesRepository.find({
      where: { tenantId, isVoided: false },
      relations: ['customer', 'createdByUser', 'updatedByUser'],
      order: { createdAt: 'DESC' },
    });

    const sourceIds = Array.from(
      new Set(
        invoices
          .map((inv) =>
            inv?.sourceQuoteId ? String(inv.sourceQuoteId) : '',
          )
          .filter(Boolean),
      ),
    );
    if (sourceIds.length === 0) {
      return invoices as any;
    }

    const quotes = await this.quotesRepository.find({
      where: { tenantId, id: In(sourceIds) },
      select: { id: true, quoteNumber: true, opportunityId: true },
    });

    const byId = new Map<string, string | null>();
    const oppById = new Map<string, string | null>();
    for (const q of quotes) {
      byId.set(String(q.id), q.quoteNumber ? String(q.quoteNumber) : null);
      oppById.set(
        String(q.id),
        q.opportunityId ? String(q.opportunityId) : null,
      );
    }

    return invoices.map((inv) => ({
      ...(inv as any),
      sourceQuoteNumber: inv.sourceQuoteId
        ? (byId.get(String(inv.sourceQuoteId)) ?? null)
        : null,
      sourceOpportunityId: inv.sourceQuoteId
        ? (oppById.get(String(inv.sourceQuoteId)) ?? null)
        : null,
    }));
  }

  async findOne(
    tenantId: string,
    id: string,
    includeVoided = false,
  ): Promise<Invoice> {
    const whereCondition: FindOptionsWhere<Invoice> = { id, tenantId };
    if (!includeVoided) {
      whereCondition.isVoided = false;
    }

    const invoice = await this.invoicesRepository.findOne({
      where: whereCondition,
      relations: ['customer', 'voidedByUser', 'createdByUser', 'updatedByUser'],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice #${id} not found`);
    }

    if (invoice.sourceQuoteId) {
      try {
        const q = await this.quotesRepository.findOne({
          where: { tenantId, id: String(invoice.sourceQuoteId) },
          select: { id: true, quoteNumber: true, opportunityId: true },
        });
        (invoice as any).sourceQuoteNumber = q?.quoteNumber
          ? String(q.quoteNumber)
          : null;
        (invoice as any).sourceOpportunityId = q?.opportunityId
          ? String(q.opportunityId)
          : null;
      } catch {
        (invoice as any).sourceQuoteNumber = null;
        (invoice as any).sourceOpportunityId = null;
      }
    }

    return invoice;
  }

  async update(
    tenantId: string,
    id: string,
    updateInvoiceDto: UpdateInvoiceDto,
  ): Promise<Invoice> {
    const invoice = await this.findOne(tenantId, id);
    const wasRefund =
      String(invoice.type || '').toLowerCase() === 'refund' ||
      String(invoice.type || '').toLowerCase() === 'return';
    const previousItems = Array.isArray(invoice.items) ? invoice.items : [];
    const previousQuantityMap = this.buildProductQuantityMap(previousItems);
    let stockAdjustments = new Map<string, number>();

    // Recalculate if items are updated
    if (updateInvoiceDto.lineItems || updateInvoiceDto.items) {
      const rawItems =
        updateInvoiceDto.lineItems ?? updateInvoiceDto.items ?? [];
      const items: InvoiceLineItemInput[] = Array.isArray(rawItems)
        ? rawItems
        : [];

      // Her ürün için KDV hesapla (Fiyatlar KDV HARİÇ)
      let subtotal = 0; // KDV HARİÇ toplam
      let taxAmount = 0; // KDV tutarı

      for (const item of items) {
        const itemTotal =
          (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0); // KDV HARİÇ
        const effectiveRate = await this.resolveTaxRate(tenantId, item);
        const itemTaxRate = Number(effectiveRate) / 100; // % => oran
        const itemTax = itemTotal * itemTaxRate; // KDV tutarı

        if (item) {
          item.taxRate = effectiveRate;
        }

        subtotal += itemTotal; // KDV HARİÇ toplam
        taxAmount += itemTax; // KDV toplamı
      }

      const discountAmount =
        Number(updateInvoiceDto.discountAmount ?? invoice.discountAmount) || 0;
      const total = subtotal + taxAmount - discountAmount; // KDV DAHİL toplam

      updateInvoiceDto.items = items;
      updateInvoiceDto.subtotal = subtotal;
      updateInvoiceDto.taxAmount = taxAmount;
      updateInvoiceDto.total = total;

      const nextQuantityMap = this.buildProductQuantityMap(items);
      stockAdjustments = this.diffProductQuantities(
        previousQuantityMap,
        nextQuantityMap,
      );
    }

    Object.assign(invoice, updateInvoiceDto);
    await this.invoicesRepository.save(invoice);

    // İade faturası yapıldığında: stok geri ekle + satış iptal et
    const isNowRefund =
      String(invoice.type || '').toLowerCase() === 'refund' ||
      String(invoice.type || '').toLowerCase() === 'return';
    const isRefundTransition = !wasRefund && isNowRefund;
    if (!wasRefund && isNowRefund) {
      try {
        // Stok geri ekle
        const lineItems: InvoiceLineItemInput[] = Array.isArray(invoice.items)
          ? invoice.items
          : [];
        for (const it of lineItems) {
          const pid = it?.productId ? String(it.productId) : '';
          const qty = Number(it?.quantity) || 0;
          if (!pid) continue;
          try {
            const product = await this.productsRepository.findOne({
              where: { id: pid, tenantId },
            });
            if (!product) continue;
            // İade faturasında miktar negatif olabilir; stoğu her durumda artırmalıyız
            const delta = qty < 0 ? Math.abs(qty) : qty;
            product.stock = Number(product.stock || 0) + delta;
            await this.productsRepository.save(product);
          } catch (error) {
            this.logStockUpdateFailure(
              'invoices.refund.productAdjustFailed',
              error,
            );
          }
        }
        // Satış iptal et
        if (invoice.saleId) {
          const sale = await this.salesRepository.findOne({
            where: { id: invoice.saleId, tenantId },
          });
          if (sale) {
            sale.status = SaleStatus.REFUNDED;
            await this.salesRepository.save(sale);
          }
        }
      } catch (error) {
        this.logStockUpdateFailure(
          'invoices.refund.stockFlowFailed',
          error,
          'error',
        );
      }
    }

    if (stockAdjustments.size && !isRefundTransition) {
      await this.applyStockAdjustments(tenantId, stockAdjustments, 'update');
    }

    // Reload with customer relation
    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const invoice = await this.findOne(tenantId, id);
    await this.invoicesRepository.remove(invoice);
  }

  async voidInvoice(
    tenantId: string,
    id: string,
    userId: string,
    reason?: string,
  ): Promise<Invoice> {
    const invoice = await this.findOne(tenantId, id, true);

    if (invoice.isVoided) {
      throw new Error('Invoice is already voided');
    }

    invoice.isVoided = true;
    invoice.voidReason = reason ?? null;
    invoice.voidedAt = new Date();
    invoice.voidedBy = userId;

    await this.invoicesRepository.save(invoice);

    // Void işleminde: stok geri ekle/azalt (kalem miktarının işaretine göre) + satış iptal et
    try {
      // Stok geri ekle
      const lineItems: InvoiceLineItemInput[] = Array.isArray(invoice.items)
        ? invoice.items
        : [];
      for (const it of lineItems) {
        const pid = it?.productId ? String(it.productId) : '';
        const qty = Number(it?.quantity) || 0;
        if (!pid) continue;
        try {
          const product = await this.productsRepository.findOne({
            where: { id: pid, tenantId },
          });
          if (!product) continue;
          // Normal satış faturası (qty>0) void: stok artar
          // İade faturası (qty<0) void: stok azalır (eklenen geri alınır)
          product.stock = Number(product.stock || 0) + qty;
          await this.productsRepository.save(product);
        } catch (error) {
          this.logStockUpdateFailure(
            'invoices.void.productAdjustFailed',
            error,
          );
        }
      }
      // Satış iptal et
      if (invoice.saleId) {
        const sale = await this.salesRepository.findOne({
          where: { id: invoice.saleId, tenantId },
        });
        if (sale) {
          sale.status = 'cancelled' as unknown as SaleStatus;
          await this.salesRepository.save(sale);
        }
      }
    } catch (error) {
      this.logStockUpdateFailure(
        'invoices.void.stockFlowFailed',
        error,
        'error',
      );
    }

    return invoice;
  }

  async restoreInvoice(tenantId: string, id: string): Promise<Invoice> {
    const invoice = await this.findOne(tenantId, id, true);

    if (!invoice.isVoided) {
      throw new Error('Invoice is not voided');
    }

    invoice.isVoided = false;
    invoice.voidReason = null;
    invoice.voidedAt = null;
    invoice.voidedBy = null;

    return this.invoicesRepository.save(invoice);
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: InvoiceStatus,
  ): Promise<Invoice> {
    const invoice = await this.findOne(tenantId, id);
    invoice.status = status;
    return this.invoicesRepository.save(invoice);
  }

  async getStatistics(tenantId: string): Promise<InvoiceStatistics> {
    const invoices = await this.findAll(tenantId);

    const total = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const paid = invoices
      .filter((inv) => inv.status === InvoiceStatus.PAID)
      .reduce((sum, inv) => sum + Number(inv.total), 0);
    const pending = invoices
      .filter((inv) => inv.status === InvoiceStatus.SENT)
      .reduce((sum, inv) => sum + Number(inv.total), 0);
    const overdue = invoices
      .filter((inv) => inv.status === InvoiceStatus.OVERDUE)
      .reduce((sum, inv) => sum + Number(inv.total), 0);

    return {
      total,
      paid,
      pending,
      overdue,
      count: invoices.length,
    };
  }
}
