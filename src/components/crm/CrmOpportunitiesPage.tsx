import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../utils/errorHandler';
import { useCurrency } from '../../contexts/CurrencyContext';
import * as crmApi from '../../api/crm';
import { getCustomers, Customer } from '../../api/customers';
import { parseLocalObject, safeSessionStorage } from '../../utils/localStorageSafe';

type Props = {
  initialAccountId?: string;
};

type StoredPageState = {
  q?: string;
  accountId?: string;
  status?: StatusFilter;
  stageId?: string;
  sortKey?: string;
  limit?: number;
};

const PAGE_STATE_KEY = 'crm.opportunities.pageState.v1';

const readPageState = (): StoredPageState | null => {
  const raw = safeSessionStorage.getItem(PAGE_STATE_KEY);
  const parsed = parseLocalObject<StoredPageState>(raw, PAGE_STATE_KEY);
  if (!parsed) return null;
  return parsed;
};

type StatusFilter = 'all' | 'open' | 'won' | 'lost';

type OpportunitySortKey =
  | 'updatedDesc'
  | 'updatedAsc'
  | 'createdDesc'
  | 'createdAsc'
  | 'nameAsc'
  | 'nameDesc';

const toDateLabel = (value: string | null | undefined, locale: string): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '-';
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(parsed));
  }
  return raw;
};

export default function CrmOpportunitiesPage({ initialAccountId }: Props) {
  const { t, i18n } = useTranslation('common');
  const { formatCurrency } = useCurrency();

  const restored = useMemo(() => readPageState(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stages, setStages] = useState<crmApi.CrmStage[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [q, setQ] = useState(() => (typeof restored?.q === 'string' ? restored.q : ''));
  const [debouncedQ, setDebouncedQ] = useState('');
  const [accountId, setAccountId] = useState<string>(() => {
    if (initialAccountId) return initialAccountId;
    return typeof restored?.accountId === 'string' ? restored.accountId : '';
  });
  const [status, setStatus] = useState<StatusFilter>(() => {
    const v = restored?.status;
    return v === 'open' || v === 'won' || v === 'lost' || v === 'all' ? v : 'all';
  });
  const [stageId, setStageId] = useState<string>(() => (typeof restored?.stageId === 'string' ? restored.stageId : ''));

  const [sortKey, setSortKey] = useState<OpportunitySortKey>(() => {
    const v = restored?.sortKey;
    const allowed: OpportunitySortKey[] = ['updatedDesc', 'updatedAsc', 'createdDesc', 'createdAsc', 'nameAsc', 'nameDesc'];
    return typeof v === 'string' && (allowed as string[]).includes(v)
      ? (v as OpportunitySortKey)
      : 'updatedDesc';
  });

  const [limit, setLimit] = useState(() => {
    const v = restored?.limit;
    return typeof v === 'number' && Number.isFinite(v) ? v : 25;
  });
  const [offset, setOffset] = useState(0);

  const [page, setPage] = useState<crmApi.CrmOpportunityListResponse>({
    items: [],
    total: 0,
    limit: 25,
    offset: 0,
  });

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

    return defaultStageKey
      ? (t(`crm.pipeline.stages.${defaultStageKey}`) as string)
      : stage.name;
  };

  const statusLabel = (value: StatusFilter | crmApi.CrmOpportunity['status']): string => {
    const key = value === 'open' ? 'open' : value === 'won' ? 'won' : value === 'lost' ? 'lost' : 'all';
    return t(`crm.opportunities.status.${key}`) as string;
  };

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customers) {
      if (c?.id) map.set(c.id, c.name);
    }
    return map;
  }, [customers]);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => window.clearTimeout(handle);
  }, [q]);

  useEffect(() => {
    if (!initialAccountId) return;
    setAccountId((prev) => (prev === initialAccountId ? prev : initialAccountId));
  }, [initialAccountId]);

  useEffect(() => {
    safeSessionStorage.setItem(
      PAGE_STATE_KEY,
      JSON.stringify(
        {
          q,
          accountId,
          status,
          stageId,
          sortKey,
          limit,
        } satisfies StoredPageState,
      ),
    );
  }, [q, accountId, status, stageId, sortKey, limit]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Ensure pipeline exists
        await crmApi.bootstrapPipeline();

        const [stageData, customersData] = await Promise.all([
          crmApi.getStages(),
          getCustomers().catch(() => [] as Customer[]),
        ]);

        if (cancelled) return;

        setStages(Array.isArray(stageData) ? stageData : []);
        setCustomers(Array.isArray(customersData) ? customersData : []);
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setOffset(0);
  }, [debouncedQ, accountId, status, stageId, sortKey, limit]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await crmApi.listOpportunities({
          q: debouncedQ || undefined,
          stageId: stageId || undefined,
          accountId: accountId || undefined,
          status: status === 'all' ? undefined : status,
          ...(sortKey === 'updatedAsc'
            ? { sortBy: 'updatedAt' as const, sortDir: 'asc' as const }
            : sortKey === 'createdDesc'
              ? { sortBy: 'createdAt' as const, sortDir: 'desc' as const }
              : sortKey === 'createdAsc'
                ? { sortBy: 'createdAt' as const, sortDir: 'asc' as const }
                : sortKey === 'nameAsc'
                  ? { sortBy: 'name' as const, sortDir: 'asc' as const }
                  : sortKey === 'nameDesc'
                    ? { sortBy: 'name' as const, sortDir: 'desc' as const }
                    : { sortBy: 'updatedAt' as const, sortDir: 'desc' as const }),
          limit,
          offset,
        });

        if (!cancelled) {
          setPage({
            items: Array.isArray(res?.items) ? res.items : [],
            total: typeof res?.total === 'number' ? res.total : 0,
            limit: typeof res?.limit === 'number' ? res.limit : limit,
            offset: typeof res?.offset === 'number' ? res.offset : offset,
          });
        }
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQ, accountId, stageId, status, sortKey, limit, offset]);

  const total = page.total;
  const start = total === 0 ? 0 : Math.min(total, page.offset + 1);
  const end = Math.min(total, page.offset + page.items.length);

  const canPrev = page.offset > 0;
  const canNext = page.offset + page.items.length < total;

  const openDeal = (id: string) => {
    try {
      window.location.hash = `crm-deal:${id}`;
    } catch {
      // ignore
    }
  };

  const openOppTasks = (id: string) => {
    try {
      window.location.hash = `crm-tasks-opp:${id}`;
    } catch {
      // ignore
    }
  };

  const openOppActivities = (id: string) => {
    try {
      window.location.hash = `crm-activities-opp:${id}`;
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">{t('crm.opportunities.title')}</div>
          <div className="mt-2 text-sm text-gray-500">{t('crm.opportunities.subtitle')}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">{t('crm.opportunities.filters.search')}</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('crm.opportunities.searchPlaceholder') as string}
            className="w-full border rounded-lg px-3 py-2 border-gray-300"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('crm.opportunities.filters.account')}</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 border-gray-300"
          >
            <option value="">{t('crm.opportunities.filters.allAccounts')}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('crm.opportunities.filters.status')}</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="w-full border rounded-lg px-3 py-2 border-gray-300"
          >
            <option value="all">{statusLabel('all')}</option>
            <option value="open">{statusLabel('open')}</option>
            <option value="won">{statusLabel('won')}</option>
            <option value="lost">{statusLabel('lost')}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('crm.opportunities.filters.stage')}</label>
          <select
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 border-gray-300"
          >
            <option value="">{t('crm.opportunities.filters.allStages')}</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {stageLabel(s)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('app.sort.label')}</label>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as OpportunitySortKey)}
            className="w-full border rounded-lg px-3 py-2 border-gray-300"
            aria-label={t('app.sort.label') as string}
          >
            <option value="updatedDesc">{t('app.sort.updatedDesc')}</option>
            <option value="updatedAsc">{t('app.sort.updatedAsc')}</option>
            <option value="createdDesc">{t('app.sort.createdDesc')}</option>
            <option value="createdAsc">{t('app.sort.createdAsc')}</option>
            <option value="nameAsc">{t('app.sort.nameAsc')}</option>
            <option value="nameDesc">{t('app.sort.nameDesc')}</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-gray-500">
          {t('pagination.range', { start, end, total })}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">{t('pagination.itemsPerPage')}</label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 25)}
            className="border rounded px-2 py-1 text-sm border-gray-300"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {loading && <div className="mt-4 text-sm text-gray-600">{t('common.loading')}</div>}
      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      {!loading && !error && page.items.length === 0 && (() => {
        const hasActiveFilters =
          Boolean(q.trim()) ||
          Boolean(accountId) ||
          Boolean(stageId) ||
          status !== 'all';
        return (
          <div className="mt-6 text-sm text-gray-600">
            {hasActiveFilters ? t('common.noResults') : t('crm.opportunities.empty')}
          </div>
        );
      })()}

      {!loading && !error && page.items.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2 pr-4">{t('crm.fields.name')}</th>
                <th className="py-2 pr-4">{t('crm.fields.account')}</th>
                <th className="py-2 pr-4">{t('crm.pipeline.fields.amount')}</th>
                <th className="py-2 pr-4">{t('crm.pipeline.fields.stage')}</th>
                <th className="py-2 pr-4">{t('crm.pipeline.fields.expectedCloseDate')}</th>
                <th className="py-2 pr-4">{t('crm.fields.status')}</th>
                <th className="py-2">{t('crm.fields.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((opp) => (
                <tr key={opp.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => openDeal(opp.id)}
                      className="text-blue-600 hover:underline text-left"
                    >
                      {opp.name}
                    </button>
                  </td>
                  <td className="py-2 pr-4 text-gray-700">
                    {customerNameById.get(opp.accountId) || opp.accountId || '-'}
                  </td>
                  <td className="py-2 pr-4 text-gray-700">
                    {formatCurrency(Number(opp.amount ?? 0), (opp.currency as any) ?? 'TRY')}
                  </td>
                  <td className="py-2 pr-4 text-gray-700">
                    {stageLabel(stages.find((s) => s.id === opp.stageId) ?? { id: opp.stageId, name: opp.stageId, order: 0, isClosedWon: false, isClosedLost: false })}
                  </td>
                  <td className="py-2 pr-4 text-gray-700">{toDateLabel(opp.expectedCloseDate, i18n.language)}</td>
                  <td className="py-2 pr-4 text-gray-700">{statusLabel(opp.status)}</td>
                  <td className="py-2">
                    <div className="flex flex-col items-start gap-1">
                      <button
                        type="button"
                        onClick={() => openDeal(opp.id)}
                        className="text-blue-600 hover:underline"
                      >
                        {t('crm.opportunities.actions.open')}
                      </button>
                      <button
                        type="button"
                        onClick={() => openOppActivities(opp.id)}
                        className="text-blue-600 hover:underline"
                      >
                        {t('sidebar.crmActivities')}
                      </button>
                      <button
                        type="button"
                        onClick={() => openOppTasks(opp.id)}
                        className="text-blue-600 hover:underline"
                      >
                        {t('sidebar.crmTasks')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
              className="px-3 py-2 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('pagination.previous')}
            </button>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setOffset((prev) => prev + limit)}
              className="px-3 py-2 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('pagination.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
