import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import * as crmApi from '../../api/crm';
import * as quotesApi from '../../api/quotes';
import type { SaleRecord } from '../../api/sales';
import type { Invoice } from '../../api/invoices';
import { Currency, useCurrency } from '../../contexts/CurrencyContext';
import { getCustomers, Customer } from '../../api/customers';
import { organizationsApi, OrganizationMember } from '../../api/organizations';
import { useAuth } from '../../contexts/AuthContext';
import CrmActivitiesPage from './CrmActivitiesPage';
import CrmTasksPage from './CrmTasksPage';

export default function CrmDealDetailPage(props: { opportunityId: string }) {
  const { t } = useTranslation('common');
  const { formatCurrency, currency: defaultCurrency } = useCurrency();
  const { user } = useAuth();

  const opportunityId = props.opportunityId;

  const stageLabel = (stage: crmApi.CrmStage): string => {
    const normalizedName = String(stage?.name || '').trim().toLowerCase();
    const defaultStageKey =
      normalizedName === 'lead'
        ? 'lead'
        : normalizedName === 'qualified'
          ? 'qualified'
          : normalizedName === 'proposal'
            ? 'proposal'
            : normalizedName === 'negotiation'
              ? 'negotiation'
              : normalizedName === 'won'
                ? 'won'
                : normalizedName === 'lost'
                  ? 'lost'
                  : null;

    return defaultStageKey ? (t(`crm.pipeline.stages.${defaultStageKey}`) as string) : stage.name;
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stages, setStages] = useState<crmApi.CrmStage[]>([]);
  const [opportunity, setOpportunity] = useState<crmApi.CrmOpportunity | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [linkedQuotes, setLinkedQuotes] = useState<quotesApi.Quote[]>([]);
  const [linkedSales, setLinkedSales] = useState<SaleRecord[]>([]);
  const [linkedInvoices, setLinkedInvoices] = useState<Invoice[]>([]);
  const [loadingLinkedDocs, setLoadingLinkedDocs] = useState(false);
  const [creatingQuote, setCreatingQuote] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [movingStage, setMovingStage] = useState(false);

  const loadLinkedDocs = async () => {
    setLoadingLinkedDocs(true);
    try {
      const [sales, invoices] = await Promise.all([
        crmApi.getOpportunitySales(opportunityId),
        crmApi.getOpportunityInvoices(opportunityId),
      ]);
      setLinkedSales(Array.isArray(sales) ? sales : []);
      setLinkedInvoices(Array.isArray(invoices) ? invoices : []);
    } catch (e) {
      logger.warn('crm.dealDetail.linkedDocs.loadFailed', e);
      setLinkedSales([]);
      setLinkedInvoices([]);
    } finally {
      setLoadingLinkedDocs(false);
    }
  };

  const taskAssignees = useMemo(() => {
    if (!opportunity) return [] as Array<{ id: string; label: string }>;
    const allowedIds = new Set<string>([
      ...(opportunity.ownerUserId ? [opportunity.ownerUserId] : []),
      ...((Array.isArray(opportunity.teamUserIds) ? opportunity.teamUserIds : []).filter(Boolean) as string[]),
    ]);

    const list = (Array.isArray(members) ? members : [])
      .filter((m) => !!m?.user?.id && allowedIds.has(m.user.id))
      .map((m) => {
        const name = [m.user.firstName, m.user.lastName].filter(Boolean).join(' ').trim();
        return {
          id: m.user.id,
          label: name || m.user.email || m.user.id,
        };
      });

    list.sort((a, b) => a.label.localeCompare(b.label));
    return list;
  }, [members, opportunity]);

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customers) map.set(c.id, c.name);
    return map;
  }, [customers]);

  const [form, setForm] = useState<{
    name: string;
    accountId: string;
    amount: string;
    currency: Currency;
    expectedCloseDate: string;
  }>(() => ({
    name: '',
    accountId: '',
    amount: '',
    currency: defaultCurrency,
    expectedCloseDate: '',
  }));

  const reloadAll = async () => {
    setError(null);
    setLoading(true);
    try {
      const [oppData, stageData, customersData, orgs] = await Promise.all([
        crmApi.getOpportunity(opportunityId),
        crmApi.getStages(),
        getCustomers(),
        organizationsApi.getAll(),
      ]);
      setOpportunity(oppData);
      setStages(stageData ?? []);
      setCustomers(customersData ?? []);

      try {
        const quotes = await quotesApi.getQuotes({ opportunityId });
        const list = Array.isArray(quotes) ? quotes : [];
        setLinkedQuotes(list);
        void loadLinkedDocs();
      } catch (e) {
        // Quotes list should not block deal page
        logger.warn('crm.dealDetail.quotes.loadFailed', e);
        setLinkedQuotes([]);
        setLinkedSales([]);
        setLinkedInvoices([]);
      }

      const org = (orgs ?? [])[0];
      if (org?.id) {
        const membersData = await organizationsApi.getMembers(org.id);
        setMembers(membersData ?? []);
      } else {
        setMembers([]);
      }
    } catch (e) {
      logger.error('crm.dealDetail.loadFailed', e);
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reloadAll();
  }, [opportunityId]);

  useEffect(() => {
    if (!opportunity) return;
    setForm({
      name: opportunity.name ?? '',
      accountId: opportunity.accountId ?? '',
      amount: String(opportunity.amount ?? ''),
      currency: (opportunity.currency as Currency) ?? defaultCurrency,
      expectedCloseDate: opportunity.expectedCloseDate ?? '',
    });
  }, [opportunity, defaultCurrency]);

  const reloadOpportunity = async () => {
    try {
      const oppData = await crmApi.getOpportunity(opportunityId);
      setOpportunity(oppData);
      try {
        const quotes = await quotesApi.getQuotes({ opportunityId });
        const list = Array.isArray(quotes) ? quotes : [];
        setLinkedQuotes(list);
        void loadLinkedDocs();
      } catch {
        // ignore
      }
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const createDraftQuoteFromDeal = async () => {
    if (!opportunity) return;
    if (!opportunity.accountId) {
      setError(t('crm.pipeline.validation.accountRequired') as string);
      return;
    }

    const ok = window.confirm(
      t('crm.dealDetail.createQuoteConfirm', {
        defaultValue: 'Bu anlaşma için taslak teklif oluşturulsun mu?',
      }) as string,
    );
    if (!ok) return;

    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const addDays = (d: Date, days: number) =>
      new Date(d.getTime() + days * 86400000);

    const currency =
      (opportunity.currency as quotesApi.CreateQuoteDto['currency']) || 'TRY';
    const total = Number(opportunity.amount ?? 0) || 0;
    const itemTotal = total;

    try {
      setCreatingQuote(true);
      const created = await quotesApi.createQuote({
        opportunityId: opportunity.id,
        customerId: opportunity.accountId,
        issueDate: iso(today),
        validUntil: iso(addDays(today, 30)),
        currency,
        total,
        items: [
          {
            description: opportunity.name || (t('crm.dealDetail.title') as string),
            quantity: 1,
            unitPrice: total,
            total: itemTotal,
          },
        ],
        scopeOfWorkHtml: '',
      });
      if (created?.id) {
        try {
          window.location.hash = `quotes-edit:${created.id}`;
          return;
        } catch {
          // ignore
        }
      }
      await reloadOpportunity();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setCreatingQuote(false);
    }
  };

  const backToPipeline = () => {
    try {
      window.location.hash = 'crm-pipeline';
    } catch {
      // ignore
    }
  };

  const save = async () => {
    if (!opportunity) return;
    setError(null);

    const name = form.name.trim();
    if (!name) {
      setError(t('crm.pipeline.validation.nameRequired') as string);
      return;
    }

    const amount = Number(form.amount || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      setError(t('crm.pipeline.validation.amountInvalid') as string);
      return;
    }

    if (!form.accountId) {
      setError(t('crm.pipeline.validation.accountRequired') as string);
      return;
    }

    try {
      setSaving(true);
      await crmApi.updateOpportunity(opportunity.id, {
        name,
        accountId: form.accountId,
        amount,
        currency: form.currency,
        expectedCloseDate: form.expectedCloseDate ? form.expectedCloseDate : null,
      });
      await reloadOpportunity();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleTeamUser = async (userId: string) => {
    if (!opportunity) return;
    setError(null);
    try {
      setSavingTeam(true);
      const current = Array.isArray(opportunity.teamUserIds) ? opportunity.teamUserIds : [];
      const has = current.includes(userId);
      const next = has ? current.filter((id) => id !== userId) : [...current, userId];
      const ensuredOwnerTeam = Array.from(new Set([...(next ?? []), ...(user?.id ? [user.id] : [])]));
      await crmApi.setOpportunityTeam(opportunity.id, ensuredOwnerTeam);
      await reloadOpportunity();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSavingTeam(false);
    }
  };

  const changeStage = async (stageId: string) => {
    if (!opportunity) return;
    if (!stageId || stageId === opportunity.stageId) return;
    setError(null);
    try {
      setMovingStage(true);
      await crmApi.moveOpportunity(opportunity.id, stageId);
      await reloadOpportunity();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setMovingStage(false);
    }
  };

  const headerSubtitle = useMemo(() => {
    if (!opportunity) return '';
    const customerName = customerNameById.get(opportunity.accountId) || '';
    const amount = formatCurrency(Number(opportunity.amount ?? 0), (opportunity.currency as any) ?? 'TRY');
    return [customerName, amount].filter(Boolean).join(' · ');
  }, [customerNameById, formatCurrency, opportunity]);

  if (loading) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold">{t('crm.dealDetail.title')}</h2>
        <p className="text-sm text-gray-600">{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t('crm.dealDetail.title')}</h2>
          <button
            type="button"
            onClick={backToPipeline}
            className="px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            {t('crm.dealDetail.backToPipeline')}
          </button>
        </div>
        <p className="mt-3 text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t('crm.dealDetail.title')}</h2>
          <button
            type="button"
            onClick={backToPipeline}
            className="px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            {t('crm.dealDetail.backToPipeline')}
          </button>
        </div>
        <p className="mt-3 text-sm text-gray-600">{t('crm.dealDetail.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-gray-900">{opportunity.name}</div>
            {headerSubtitle && <div className="mt-2 text-sm text-gray-500">{headerSubtitle}</div>}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={backToPipeline}
              className="px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              {t('crm.dealDetail.backToPipeline')}
            </button>
            <button
              type="button"
              onClick={() => void createDraftQuoteFromDeal()}
              className="px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={creatingQuote}
            >
              {creatingQuote
                ? (t('common.loading', { defaultValue: 'Yükleniyor...' }) as string)
                : (t('crm.dealDetail.createQuote', {
                    defaultValue: 'Teklif oluştur',
                  }) as string)}
            </button>
            <button
              type="button"
              onClick={save}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50"
              disabled={saving}
            >
              {saving ? t('crm.pipeline.saving') : t('common.save')}
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.pipeline.fields.opportunityName')}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 border-gray-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.pipeline.fields.account')}</label>
            <select
              value={form.accountId}
              onChange={(e) => setForm((p) => ({ ...p, accountId: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 border-gray-300"
            >
              <option value="">{t('crm.pipeline.selectPlaceholder')}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.pipeline.fields.amount')}</label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 border-gray-300"
              min={0}
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.pipeline.fields.currency')}</label>
            <select
              value={form.currency}
              onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value as Currency }))}
              className="w-full border rounded-lg px-3 py-2 border-gray-300"
            >
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.pipeline.fields.expectedCloseDate')}</label>
            <input
              type="date"
              value={form.expectedCloseDate}
              onChange={(e) => setForm((p) => ({ ...p, expectedCloseDate: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 border-gray-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.pipeline.fields.stage')}</label>
            <select
              value={opportunity.stageId}
              onChange={(e) => void changeStage(e.target.value)}
              disabled={movingStage}
              className="w-full border rounded-lg px-3 py-2 border-gray-300"
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {stageLabel(s)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-sm font-medium text-gray-900">{t('crm.pipeline.fields.team')}</div>
          <div className="mt-2 border rounded-lg p-3 max-h-56 overflow-auto">
            {members.length === 0 && <div className="text-sm text-gray-500">{t('crm.pipeline.noMembers')}</div>}
            <div className="space-y-2">
              {members.map((m) => {
                const memberUserId = m.user.id;
                const isOwner = user?.id && memberUserId === user.id;
                const checked = (opportunity.teamUserIds ?? []).includes(memberUserId) || !!isOwner;
                return (
                  <label key={m.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={savingTeam || !!isOwner}
                      onChange={() => void toggleTeamUser(memberUserId)}
                    />
                    <span className="text-gray-800">
                      {m.user.firstName} {m.user.lastName} ({m.user.email})
                    </span>
                  </label>
                );
              })}
            </div>
            {user?.id && <div className="mt-2 text-xs text-gray-500">{t('crm.pipeline.ownerAutoInTeam')}</div>}
          </div>
        </div>

        {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-gray-900">
            {t('crm.dealDetail.linkedDocs', {
              defaultValue: 'Bağlı satışlar ve faturalar',
            })}{' '}
            <span className="text-xs font-normal text-gray-500">
              ({linkedSales.length + linkedInvoices.length})
            </span>
          </div>
        </div>

        {loadingLinkedDocs ? (
          <div className="mt-3 text-sm text-gray-600">
            {t('common.loading', { defaultValue: 'Yükleniyor...' }) as string}
          </div>
        ) : linkedSales.length === 0 && linkedInvoices.length === 0 ? (
          <div className="mt-3 text-sm text-gray-600">
            {t('crm.dealDetail.noLinkedDocs', {
              defaultValue: 'Bu anlaşmaya bağlı satış veya fatura yok.',
            })}
          </div>
        ) : (
          <div className="mt-3 space-y-6">
            <div>
              <div className="text-sm font-medium text-gray-900">
                {t('sales.title', { defaultValue: 'Satışlar' }) as string}{' '}
                <span className="text-xs font-normal text-gray-500">({linkedSales.length})</span>
              </div>
              {linkedSales.length === 0 ? (
                <div className="mt-2 text-sm text-gray-600">
                  {t('crm.dealDetail.noLinkedSales', { defaultValue: 'Bağlı satış yok.' })}
                </div>
              ) : (
                <div className="mt-2 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-2 pr-4">{t('sales.table.sale', { defaultValue: 'Satış' }) as string}</th>
                        <th className="py-2 pr-4">{t('sales.table.sourceQuote', { defaultValue: 'Kaynak Teklif' }) as string}</th>
                        <th className="py-2 pr-4">{t('sales.table.status', { defaultValue: 'Durum' }) as string}</th>
                        <th className="py-2 pr-4">{t('sales.table.date', { defaultValue: 'Tarih' }) as string}</th>
                        <th className="py-2">{t('sales.table.amount', { defaultValue: 'Tutar' }) as string}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {linkedSales.map((s) => {
                        const date = s.saleDate ? String(s.saleDate).slice(0, 10) : (s.date ? String(s.date).slice(0, 10) : '');
                        const total = Number(s.total ?? s.amount ?? 0) || 0;
                        const cur = (opportunity.currency as any) || defaultCurrency;
                        const sourceQuoteNumber = (s as any)?.sourceQuoteNumber ? String((s as any).sourceQuoteNumber) : '';
                        const sourceQuoteId = s?.sourceQuoteId ? String(s.sourceQuoteId) : '';
                        return (
                          <tr key={s.id} className="text-gray-800">
                            <td className="py-2 pr-4 font-medium">
                              <button
                                type="button"
                                className="text-indigo-600 hover:text-indigo-800"
                                onClick={() => {
                                  try {
                                    window.location.hash = `sales-edit:${s.id}`;
                                  } catch {
                                    // ignore
                                  }
                                }}
                                title={t('sales.edit', { defaultValue: 'Satışı Düzenle' }) as string}
                              >
                                {s.saleNumber || s.id}
                              </button>
                            </td>
                            <td className="py-2 pr-4">
                              {sourceQuoteId ? (
                                <button
                                  type="button"
                                  className="text-indigo-600 hover:text-indigo-800"
                                  onClick={() => {
                                    try {
                                      window.location.hash = `quotes-edit:${sourceQuoteId}`;
                                    } catch {
                                      // ignore
                                    }
                                  }}
                                  title={t('quotes.editModal.title', { defaultValue: 'Teklifi Düzenle' }) as string}
                                >
                                  {sourceQuoteNumber || '-'}
                                </button>
                              ) : (
                                <span>{sourceQuoteNumber || '-'}</span>
                              )}
                            </td>
                            <td className="py-2 pr-4">{String(s.status || '').toUpperCase()}</td>
                            <td className="py-2 pr-4">{date}</td>
                            <td className="py-2">{formatCurrency(total, cur)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <div className="text-sm font-medium text-gray-900">
                {t('invoices.title', { defaultValue: 'Faturalar' }) as string}{' '}
                <span className="text-xs font-normal text-gray-500">({linkedInvoices.length})</span>
              </div>
              {linkedInvoices.length === 0 ? (
                <div className="mt-2 text-sm text-gray-600">
                  {t('crm.dealDetail.noLinkedInvoices', { defaultValue: 'Bağlı fatura yok.' })}
                </div>
              ) : (
                <div className="mt-2 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-2 pr-4">{t('invoices.table.invoice', { defaultValue: 'Fatura' }) as string}</th>
                        <th className="py-2 pr-4">{t('invoices.table.sourceQuote', { defaultValue: 'Kaynak Teklif' }) as string}</th>
                        <th className="py-2 pr-4">{t('invoices.table.status', { defaultValue: 'Durum' }) as string}</th>
                        <th className="py-2 pr-4">{t('invoices.table.date', { defaultValue: 'Tarih' }) as string}</th>
                        <th className="py-2">{t('invoices.table.total', { defaultValue: 'Tutar' }) as string}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {linkedInvoices.map((inv) => {
                        const issue = inv.issueDate ? String(inv.issueDate).slice(0, 10) : '';
                        const total = Number(inv.total ?? 0) || 0;
                        const cur = (opportunity.currency as any) || defaultCurrency;
                        const sourceQuoteNumber = (inv as any)?.sourceQuoteNumber ? String((inv as any).sourceQuoteNumber) : '';
                        const sourceQuoteId = (inv as any)?.sourceQuoteId ? String((inv as any).sourceQuoteId) : '';
                        return (
                          <tr key={inv.id} className="text-gray-800">
                            <td className="py-2 pr-4 font-medium">
                              <button
                                type="button"
                                className="text-indigo-600 hover:text-indigo-800"
                                onClick={() => {
                                  try {
                                    window.location.hash = `invoices-edit:${inv.id}`;
                                  } catch {
                                    // ignore
                                  }
                                }}
                                title={t('invoices.edit', { defaultValue: 'Faturayı Düzenle' }) as string}
                              >
                                {inv.invoiceNumber || inv.id}
                              </button>
                            </td>
                            <td className="py-2 pr-4">
                              {sourceQuoteId ? (
                                <button
                                  type="button"
                                  className="text-indigo-600 hover:text-indigo-800"
                                  onClick={() => {
                                    try {
                                      window.location.hash = `quotes-edit:${sourceQuoteId}`;
                                    } catch {
                                      // ignore
                                    }
                                  }}
                                  title={t('quotes.editModal.title', { defaultValue: 'Teklifi Düzenle' }) as string}
                                >
                                  {sourceQuoteNumber || '-'}
                                </button>
                              ) : (
                                <span>{sourceQuoteNumber || '-'}</span>
                              )}
                            </td>
                            <td className="py-2 pr-4">{String(inv.status || '').toUpperCase()}</td>
                            <td className="py-2 pr-4">{issue}</td>
                            <td className="py-2">{formatCurrency(total, cur)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-gray-900">
            {t('crm.dealDetail.linkedQuotes', {
              defaultValue: 'Bağlı teklifler',
            })}{' '}
            <span className="text-xs font-normal text-gray-500">
              ({linkedQuotes.length})
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              try {
                window.location.hash = 'quotes';
              } catch {
                // ignore
              }
            }}
            className="px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            {t('quotes.title', { defaultValue: 'Teklifler' }) as string}
          </button>
        </div>

        {linkedQuotes.length === 0 ? (
          <div className="mt-3 text-sm text-gray-600">
            {t('crm.dealDetail.noLinkedQuotes', {
              defaultValue: 'Bu anlaşmaya bağlı teklif yok.',
            })}
          </div>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-4">{t('quotes.table.quote', { defaultValue: 'Teklif' }) as string}</th>
                  <th className="py-2 pr-4">{t('quotes.table.status', { defaultValue: 'Durum' }) as string}</th>
                  <th className="py-2 pr-4">{t('quotes.table.date', { defaultValue: 'Tarih' }) as string}</th>
                  <th className="py-2">{t('quotes.table.amount', { defaultValue: 'Tutar' }) as string}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {linkedQuotes.map((q) => {
                  const issue = q.issueDate ? String(q.issueDate).slice(0, 10) : '';
                  const total = Number(q.total ?? 0) || 0;
                  const cur = (q.currency as any) || 'TRY';
                  return (
                    <tr key={q.id} className="text-gray-800">
                      <td className="py-2 pr-4 font-medium">
                        <button
                          type="button"
                          className="text-indigo-600 hover:text-indigo-800"
                          onClick={() => {
                            try {
                              window.location.hash = `quotes-edit:${q.id}`;
                            } catch {
                              // ignore
                            }
                          }}
                          title={t('quotes.editModal.title', { defaultValue: 'Teklifi Düzenle' }) as string}
                        >
                          {q.quoteNumber}
                        </button>
                      </td>
                      <td className="py-2 pr-4">{String(q.status || '').toUpperCase()}</td>
                      <td className="py-2 pr-4">{issue}</td>
                      <td className="py-2">{formatCurrency(total, cur)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CrmActivitiesPage opportunityId={opportunity.id} dealName={opportunity.name} />

      <div className="mt-6">
        <CrmTasksPage opportunityId={opportunity.id} dealName={opportunity.name} assignees={taskAssignees} />
      </div>
    </div>
  );
}
