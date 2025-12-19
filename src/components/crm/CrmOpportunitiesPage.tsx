import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../utils/errorHandler';
import { useCurrency } from '../../contexts/CurrencyContext';
import * as crmApi from '../../api/crm';
import { getCustomers, Customer } from '../../api/customers';
import { parseLocalObject, safeSessionStorage } from '../../utils/localStorageSafe';
import Pagination from '../Pagination';
import SavedViewsBar from '../SavedViewsBar';

type Props = {
  initialAccountId?: string;
};

type StoredPageState = {
  q?: string;
  accountId?: string;
  status?: StatusFilter;
  stageId?: string;
  startDate?: string;
  endDate?: string;
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

  const [startDate, setStartDate] = useState(() =>
    typeof restored?.startDate === 'string' ? restored.startDate : '',
  );
  const [endDate, setEndDate] = useState(() => (typeof restored?.endDate === 'string' ? restored.endDate : ''));

  const [sortKey, setSortKey] = useState<OpportunitySortKey>(() => {
    const v = restored?.sortKey;
    const allowed: OpportunitySortKey[] = ['updatedDesc', 'updatedAsc', 'createdDesc', 'createdAsc', 'nameAsc', 'nameDesc'];
    return typeof v === 'string' && (allowed as string[]).includes(v)
      ? (v as OpportunitySortKey)
      : 'updatedDesc';
  });

  const [limit, setLimit] = useState(() => {
    const v = restored?.limit;
    const allowed = [20, 50, 100];
    return typeof v === 'number' && Number.isFinite(v) && allowed.includes(v) ? v : 20;
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
          startDate,
          endDate,
          sortKey,
          limit,
        } satisfies StoredPageState,
      ),
    );
  }, [q, accountId, status, stageId, startDate, endDate, sortKey, limit]);

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
  }, [debouncedQ, accountId, status, stageId, startDate, endDate, sortKey, limit]);

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
          startDate: startDate || undefined,
          endDate: endDate || undefined,
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
  }, [debouncedQ, accountId, stageId, status, startDate, endDate, sortKey, limit, offset]);

  const total = page.total;
  const pageNumber = Math.floor(offset / limit) + 1;

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

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="sr-only">{t('crm.opportunities.filters.search')}</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('crm.opportunities.searchPlaceholder') as string}
          className="w-full lg:flex-1 border rounded-lg px-3 py-2 border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
        />

        <div className="flex w-full gap-2 lg:w-auto">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder={t('startDate') as string}
            className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder={t('endDate') as string}
            className="w-full border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
        </div>

        <label className="sr-only">{t('crm.opportunities.filters.account')}</label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="w-full lg:w-56 border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-500"
          aria-label={t('crm.opportunities.filters.account') as string}
        >
          <option value="">{t('crm.opportunities.filters.allAccounts')}</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label className="sr-only">{t('crm.opportunities.filters.status')}</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="w-full lg:w-40 border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-500"
          aria-label={t('crm.opportunities.filters.status') as string}
        >
          <option value="all">{statusLabel('all')}</option>
          <option value="open">{statusLabel('open')}</option>
          <option value="won">{statusLabel('won')}</option>
          <option value="lost">{statusLabel('lost')}</option>
        </select>

        <label className="sr-only">{t('crm.opportunities.filters.stage')}</label>
        <select
          value={stageId}
          onChange={(e) => setStageId(e.target.value)}
          className="w-full lg:w-56 border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-500"
          aria-label={t('crm.opportunities.filters.stage') as string}
        >
          <option value="">{t('crm.opportunities.filters.allStages')}</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {stageLabel(s)}
            </option>
          ))}
        </select>

        <label className="sr-only">{t('app.sort.label')}</label>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as OpportunitySortKey)}
          className="w-full lg:w-56 border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-500"
          aria-label={t('app.sort.label') as string}
        >
          <option value="updatedDesc">{t('app.sort.updatedDesc')}</option>
          <option value="updatedAsc">{t('app.sort.updatedAsc')}</option>
          <option value="createdDesc">{t('app.sort.createdDesc')}</option>
          <option value="createdAsc">{t('app.sort.createdAsc')}</option>
          <option value="nameAsc">{t('app.sort.nameAsc')}</option>
          <option value="nameDesc">{t('app.sort.nameDesc')}</option>
        </select>

        <div className="lg:ml-auto flex items-center">
          <SavedViewsBar
            listType="crm_opportunities"
            getState={() => ({ q, accountId, status, stageId, startDate, endDate, sortKey, pageSize: limit })}
            applyState={(state) => {
              if (!state) return;
              setQ(state.q ?? '');
              setStartDate(state.startDate ?? '');
              setEndDate(state.endDate ?? '');
              if (!initialAccountId) setAccountId(state.accountId ?? '');
              if (typeof state.status === 'string') {
                const allowed: StatusFilter[] = ['all', 'open', 'won', 'lost'];
                setStatus((allowed as string[]).includes(state.status) ? (state.status as StatusFilter) : 'all');
              } else {
                setStatus('all');
              }
              setStageId(state.stageId ?? '');
              if (typeof state.sortKey === 'string') {
                const allowed: OpportunitySortKey[] = ['updatedDesc', 'updatedAsc', 'createdDesc', 'createdAsc', 'nameAsc', 'nameDesc'];
                if ((allowed as string[]).includes(state.sortKey)) setSortKey(state.sortKey as OpportunitySortKey);
              }
              if (state.pageSize && [20, 50, 100].includes(state.pageSize)) setLimit(state.pageSize);
              setOffset(0);
            }}
            presets={[
              {
                id: 'this-month',
                label: t('presets.thisMonth') as string,
                apply: () => {
                  const d = new Date();
                  const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
                  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
                  setStartDate(start);
                  setEndDate(end);
                  setOffset(0);
                },
              },
              { id: 'open', label: statusLabel('open'), apply: () => setStatus('open') },
              { id: 'won', label: statusLabel('won'), apply: () => setStatus('won') },
              { id: 'lost', label: statusLabel('lost'), apply: () => setStatus('lost') },
            ]}
          />
        </div>
      </div>

      {loading && <div className="mt-4 text-sm text-gray-600">{t('common.loading')}</div>}
      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      {!loading && !error && page.items.length === 0 && (() => {
        const hasActiveFilters =
          Boolean(q.trim()) ||
          Boolean(accountId) ||
          Boolean(stageId) ||
          Boolean(startDate) ||
          Boolean(endDate) ||
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
        </div>
      )}

      {!loading && !error && (
        <div className="mt-6 border-t border-gray-200 pt-4">
          <Pagination
            page={pageNumber}
            pageSize={limit}
            total={total}
            onPageChange={(p) => setOffset((p - 1) * limit)}
            onPageSizeChange={(size) => {
              setLimit(size);
              setOffset(0);
            }}
          />
        </div>
      )}
    </div>
  );
}
