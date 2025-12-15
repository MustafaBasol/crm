import { useTranslation } from 'react-i18next';
import type { Product, Sale } from '../../types';
import type { InvoiceRecord } from '../../types/records';
import { CrmDashboardCard } from '../crm/CrmDashboardPage';

type QuoteLike = {
  status?: string;
};

interface SummaryPageProps {
  invoices: InvoiceRecord[];
  products: Product[];
  sales: Sale[];
  quotes?: QuoteLike[];
}

const coerceDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  const asNumber = typeof value === 'number' ? value : Number.NaN;
  if (Number.isFinite(asNumber)) {
    const d = new Date(asNumber);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
};

const startOfDay = (d: Date): Date => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const startOfWeek = (d: Date): Date => {
  const copy = startOfDay(d);
  const day = copy.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // Monday-based
  copy.setDate(copy.getDate() - diff);
  return copy;
};

const isAfterOrEqual = (date: Date, min: Date): boolean => date.getTime() >= min.getTime();

export default function SummaryPage({ invoices, products, sales, quotes = [] }: SummaryPageProps) {
  const { t } = useTranslation();

  const pendingReceivables = invoices.filter(inv => {
    const status = String((inv as any).status || '').toLowerCase();
    return status !== 'paid' && status !== 'cancelled';
  }).length;

  const overdueInvoices = invoices.filter(inv => {
    const status = String((inv as any).status || '').toLowerCase();
    return status === 'overdue';
  }).length;

  const criticalStock = products.filter(p => {
    const status = String((p as any).status || '').toLowerCase();
    if (status === 'out-of-stock' || status === 'low') return true;
    const stock = Number((p as any).stockQuantity ?? (p as any).stock ?? 0);
    const min = Number((p as any).reorderLevel ?? (p as any).minStock ?? 0);
    if (!Number.isFinite(stock) || !Number.isFinite(min)) return false;
    return stock <= min;
  }).length;

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);

  const salesToday = sales.filter(s => {
    const d = coerceDate((s as any).date || (s as any).createdAt || (s as any).issueDate);
    return d ? isAfterOrEqual(d, todayStart) : false;
  }).length;

  const salesThisWeek = sales.filter(s => {
    const d = coerceDate((s as any).date || (s as any).createdAt || (s as any).issueDate);
    return d ? isAfterOrEqual(d, weekStart) : false;
  }).length;

  const awaitingInvoiceSales = sales.filter(s => {
    const invoiceId = (s as any).invoiceId || (s as any).invoice?.id;
    const status = String((s as any).status || '').toLowerCase();
    return !invoiceId && status !== 'invoiced' && status !== 'cancelled';
  }).length;

  const openQuotes = quotes.filter(q => {
    const status = String(q.status || '').toLowerCase();
    return status !== 'accepted' && status !== 'declined' && status !== 'expired';
  }).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">{t('summary.blocks.actions')}</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-gray-500">{t('summary.today')}</div>
              <div className="text-lg font-bold text-gray-900">0</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-gray-500">{t('summary.thisWeek')}</div>
              <div className="text-lg font-bold text-gray-900">0</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">{t('summary.blocks.receivables')}</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-gray-500">{t('summary.pending')}</div>
              <div className="text-lg font-bold text-gray-900">{pendingReceivables}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-gray-500">{t('summary.overdue')}</div>
              <div className="text-lg font-bold text-gray-900">{overdueInvoices}</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">{t('summary.blocks.criticalStock')}</div>
          <div className="mt-3 rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-gray-500">{t('summary.criticalProducts')}</div>
            <div className="text-lg font-bold text-gray-900">{criticalStock}</div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">{t('summary.blocks.salesFlow')}</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-gray-500">{t('summary.todayOrders')}</div>
              <div className="text-lg font-bold text-gray-900">{salesToday}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-gray-500">{t('summary.weekOrders')}</div>
              <div className="text-lg font-bold text-gray-900">{salesThisWeek}</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">{t('summary.blocks.openQuotes')}</div>
          <div className="mt-3 rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-gray-500">{t('summary.openQuotesCount')}</div>
            <div className="text-lg font-bold text-gray-900">{openQuotes}</div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">{t('summary.blocks.awaitingInvoiceSales')}</div>
          <div className="mt-3 rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-gray-500">{t('summary.awaitingInvoiceCount')}</div>
            <div className="text-lg font-bold text-gray-900">{awaitingInvoiceSales}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 min-w-0">
          <CrmDashboardCard />
        </div>
        <div className="min-w-0">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-900">{t('summary.blocks.latestActivities')}</div>
            <div className="mt-3 text-sm text-gray-500">
              {t('summary.latestActivitiesPlaceholder')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
