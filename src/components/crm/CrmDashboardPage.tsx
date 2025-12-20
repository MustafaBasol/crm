import React from 'react';
import { useTranslation } from 'react-i18next';
import * as crmApi from '../../api/crm';
import { safeSessionStorage } from '../../utils/localStorageSafe';

type TotalsByCurrency = Record<string, number>;

const formatMoney = (amount: number): string => {
  if (!Number.isFinite(amount)) return '0';
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(amount);
};

const sumByCurrency = (opps: crmApi.CrmOpportunity[]): TotalsByCurrency => {
  const totals: TotalsByCurrency = {};
  for (const opp of opps) {
    const currency = (opp.currency || 'TRY').toUpperCase();
    const amount = Number(opp.amount) || 0;
    totals[currency] = (totals[currency] || 0) + amount;
  }
  return totals;
};

export function CrmDashboardCard() {
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [openCount, setOpenCount] = React.useState(0);
  const [totalsByCurrency, setTotalsByCurrency] = React.useState<TotalsByCurrency>({});
  const [byStage, setByStage] = React.useState<Array<{ stage: string; count: number }>>([]);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);
        setError(null);

        await crmApi.bootstrapPipeline();
        const stages = await crmApi.getStages();

        const fetchAllOpenOpportunities = async (): Promise<crmApi.CrmOpportunity[]> => {
          const limit = 200;
          let offset = 0;
          const items: crmApi.CrmOpportunity[] = [];

          for (let i = 0; i < 100; i += 1) {
            const page = await crmApi.listOpportunities({ status: 'open', limit, offset });
            const pageItems = Array.isArray(page?.items) ? page.items : [];
            items.push(...pageItems);
            offset += pageItems.length;
            if (pageItems.length === 0) break;
            if (typeof page?.total === 'number' && items.length >= page.total) break;
          }

          return items;
        };

        const openOpps = await fetchAllOpenOpportunities();

        const stageNameById = new Map<string, string>(
          (Array.isArray(stages) ? stages : []).map(s => [s.id, s.name]),
        );
        const counts = new Map<string, number>();
        for (const opp of openOpps) {
          const stageName = stageNameById.get(opp.stageId) || t('summary.crm.unknownStage');
          counts.set(stageName, (counts.get(stageName) || 0) + 1);
        }
        const stageList = Array.from(counts.entries())
          .map(([stage, count]) => ({ stage, count }))
          .sort((a, b) => b.count - a.count);

        if (!cancelled) {
          setOpenCount(openOpps.length);
          setTotalsByCurrency(sumByCurrency(openOpps));
          setByStage(stageList);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(
            e?.message
              ? String(e.message)
              : t('crm.errors.boardFetch', { defaultValue: 'CRM verisi alınamadı' })
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-gray-900">{t('summary.blocks.crmFlow')}</div>
        <div className="text-xs text-gray-500">
          {isLoading
            ? t('summary.loading')
            : t('summary.crm.openDeals')}:
          <span className="ml-1 font-semibold text-gray-900">{openCount}</span>
        </div>
      </div>

      {error ? (
        <div className="mt-3 text-sm text-red-600">{error}</div>
      ) : (
        <>
          <div className="mt-3 rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-gray-500">{t('summary.crm.expectedAmount')}</div>
            <div className="mt-1 flex flex-wrap gap-3">
              {Object.keys(totalsByCurrency).length === 0 ? (
                <div className="text-lg font-bold text-gray-900">0</div>
              ) : (
                Object.entries(totalsByCurrency).map(([ccy, total]) => (
                  <div key={ccy} className="text-lg font-bold text-gray-900">
                    {formatMoney(total)} {ccy}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-3">
            {byStage.length === 0 ? (
              <div className="text-sm text-gray-500">{t('summary.crm.noStageData')}</div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {byStage.slice(0, 6).map(row => (
                  <div key={row.stage} className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2">
                    <div className="text-sm text-gray-700 truncate">{row.stage}</div>
                    <div className="text-sm font-semibold text-gray-900">{row.count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function CrmDashboardPage() {
  const { t } = useTranslation();

  const [searchQ, setSearchQ] = React.useState('');
  const [debouncedSearchQ, setDebouncedSearchQ] = React.useState('');
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [searchResult, setSearchResult] = React.useState<crmApi.CrmGlobalSearchResponse | null>(null);

  React.useEffect(() => {
    const handle = window.setTimeout(
      () => setDebouncedSearchQ(searchQ.trim()),
      300,
    );
    return () => window.clearTimeout(handle);
  }, [searchQ]);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      const q = debouncedSearchQ;
      if (!q || q.length < 2) {
        setSearchResult(null);
        setSearchError(null);
        setSearchLoading(false);
        return;
      }

      try {
        setSearchLoading(true);
        setSearchError(null);
        const res = await crmApi.globalSearch({ q, limit: 5 });
        if (!cancelled) setSearchResult(res);
      } catch (e: any) {
        if (!cancelled) {
          setSearchError(
            e?.message
              ? String(e.message)
              : (t('crm.search.error', { defaultValue: 'Arama başarısız' }) as string),
          );
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearchQ, t]);

  const anyResults = React.useMemo(() => {
    const r = searchResult;
    if (!r) return false;
    return (
      (r.accounts?.items?.length || 0) > 0 ||
      (r.opportunities?.items?.length || 0) > 0 ||
      (r.contacts?.items?.length || 0) > 0 ||
      (r.leads?.items?.length || 0) > 0 ||
      (r.tasks?.items?.length || 0) > 0 ||
      (r.activities?.items?.length || 0) > 0
    );
  }, [searchResult]);

  const setCrmListQuery = (key: string, q: string) => {
    if (!q) return;
    safeSessionStorage.setItem(key, JSON.stringify({ q }));
  };

  const go = (hash: string) => {
    window.location.hash = hash;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-gray-900">{t('sidebar.crmDashboard')}</div>
        <div className="mt-2 text-sm text-gray-500">
          {t('crm.dashboard.subtitle')}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-gray-900">{t('crm.search.title')}</div>
        <div className="mt-2 flex flex-col gap-2">
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder={t('crm.search.placeholder') as string}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-300"
          />
          <div className="text-xs text-gray-500">{t('crm.search.hint')}</div>
        </div>

        {searchError ? (
          <div className="mt-3 text-sm text-red-600">{searchError}</div>
        ) : searchLoading ? (
          <div className="mt-3 text-sm text-gray-500">{t('crm.search.loading')}</div>
        ) : debouncedSearchQ && debouncedSearchQ.length >= 2 && searchResult && !anyResults ? (
          <div className="mt-3 text-sm text-gray-500">{t('crm.search.noResults')}</div>
        ) : searchResult && anyResults ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(searchResult.accounts?.items?.length || 0) > 0 ? (
              <div className="rounded-lg border border-gray-100 bg-white p-3">
                <div className="text-xs font-semibold text-gray-900">{t('crm.search.sections.accounts')}</div>
                <div className="mt-2 space-y-1">
                  {searchResult.accounts.items.map((a) => (
                    <button
                      key={a.id}
                      className="block w-full truncate text-left text-sm text-gray-700 hover:underline"
                      onClick={() => go(`crm-opportunities:${a.id}`)}
                      type="button"
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {(searchResult.opportunities?.items?.length || 0) > 0 ? (
              <div className="rounded-lg border border-gray-100 bg-white p-3">
                <div className="text-xs font-semibold text-gray-900">{t('crm.search.sections.opportunities')}</div>
                <div className="mt-2 space-y-1">
                  {searchResult.opportunities.items.map((o) => (
                    <button
                      key={o.id}
                      className="block w-full truncate text-left text-sm text-gray-700 hover:underline"
                      onClick={() => go(`crm-deal:${o.id}`)}
                      type="button"
                    >
                      {o.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {(searchResult.contacts?.items?.length || 0) > 0 ? (
              <div className="rounded-lg border border-gray-100 bg-white p-3">
                <div className="text-xs font-semibold text-gray-900">{t('crm.search.sections.contacts')}</div>
                <div className="mt-2 space-y-1">
                  {searchResult.contacts.items.map((c) => (
                    <button
                      key={c.id}
                      className="block w-full truncate text-left text-sm text-gray-700 hover:underline"
                      onClick={() => {
                        setCrmListQuery('crm.contacts.pageState.v1', debouncedSearchQ);
                        if (c.accountId) {
                          go(`crm-contacts:${c.accountId}`);
                        } else {
                          go('crm-contacts');
                        }
                      }}
                      type="button"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {(searchResult.leads?.items?.length || 0) > 0 ? (
              <div className="rounded-lg border border-gray-100 bg-white p-3">
                <div className="text-xs font-semibold text-gray-900">{t('crm.search.sections.leads')}</div>
                <div className="mt-2 space-y-1">
                  {searchResult.leads.items.map((l) => (
                    <button
                      key={l.id}
                      className="block w-full truncate text-left text-sm text-gray-700 hover:underline"
                      onClick={() => {
                        setCrmListQuery('crm.leads.pageState.v1', debouncedSearchQ);
                        go('crm-leads');
                      }}
                      type="button"
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {(searchResult.tasks?.items?.length || 0) > 0 ? (
              <div className="rounded-lg border border-gray-100 bg-white p-3">
                <div className="text-xs font-semibold text-gray-900">{t('crm.search.sections.tasks')}</div>
                <div className="mt-2 space-y-1">
                  {searchResult.tasks.items.map((task) => (
                    <button
                      key={task.id}
                      className="block w-full truncate text-left text-sm text-gray-700 hover:underline"
                      onClick={() => {
                        if (task.opportunityId) {
                          go(`crm-tasks-opp:${task.opportunityId}`);
                        } else if (task.accountId) {
                          go(`crm-tasks:${task.accountId}`);
                        } else {
                          setCrmListQuery('crm.tasks.pageState.v1', debouncedSearchQ);
                          go('crm-tasks');
                        }
                      }}
                      type="button"
                    >
                      {task.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {(searchResult.activities?.items?.length || 0) > 0 ? (
              <div className="rounded-lg border border-gray-100 bg-white p-3">
                <div className="text-xs font-semibold text-gray-900">{t('crm.search.sections.activities')}</div>
                <div className="mt-2 space-y-1">
                  {searchResult.activities.items.map((a) => (
                    <button
                      key={a.id}
                      className="block w-full truncate text-left text-sm text-gray-700 hover:underline"
                      onClick={() => {
                        if (a.opportunityId) {
                          go(`crm-activities-opp:${a.opportunityId}`);
                        } else if (a.accountId) {
                          go(`crm-activities:${a.accountId}`);
                        } else {
                          setCrmListQuery('crm.activities.pageState.v1', debouncedSearchQ);
                          go('crm-activities');
                        }
                      }}
                      type="button"
                    >
                      {a.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <CrmDashboardCard />

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-gray-900">{t('summary.blocks.latestActivities')}</div>
        <div className="mt-2 text-sm text-gray-500">
          {t('summary.latestActivitiesPlaceholder')}
        </div>
      </div>
    </div>
  );
}
