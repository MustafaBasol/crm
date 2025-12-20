import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as crmReportsApi from '../../api/crm-reports';
import { getErrorMessage } from '../../utils/errorHandler';

const formatMoney = (amount: number): string => {
  if (!Number.isFinite(amount)) return '0';
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(amount);
};

const formatPct = (value: number | null): string => {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value * 1000) / 10}%`;
};

const toDateInputValue = (d: Date): string => {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function CrmReportsPage() {
  const { t } = useTranslation('common');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [staleDays, setStaleDays] = useState(30);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 30);
    return toDateInputValue(d);
  });
  const [endDate, setEndDate] = useState(() => toDateInputValue(new Date()));

  const [pipelineHealth, setPipelineHealth] = useState<crmReportsApi.PipelineHealthReport | null>(null);
  const [funnel, setFunnel] = useState<crmReportsApi.FunnelReport | null>(null);
  const [forecast, setForecast] = useState<crmReportsApi.ForecastReport | null>(null);
  const [activity, setActivity] = useState<crmReportsApi.ActivityReport | null>(null);
  const [activityBucket, setActivityBucket] = useState<'day' | 'week'>('week');

  const stageNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of pipelineHealth?.byStage || []) {
      map.set(String(s.stageId), String(s.stageName));
    }
    return map;
  }, [pipelineHealth]);

  const totalsByCurrencyList = useMemo(() => {
    const totals = pipelineHealth?.totalsByCurrency || {};
    return Object.entries(totals)
      .map(([ccy, total]) => ({ ccy, total }))
      .sort((a, b) => b.total - a.total);
  }, [pipelineHealth]);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);

      const [ph, fn, fc, ac] = await Promise.all([
        crmReportsApi.getPipelineHealth({ staleDays }),
        crmReportsApi.getFunnel({ startDate, endDate }),
        crmReportsApi.getForecast({ startDate, endDate }),
        crmReportsApi.getActivity({ startDate, endDate, bucket: activityBucket }),
      ]);

      setPipelineHealth(ph);
      setFunnel(fn);
      setForecast(fc);
      setActivity(ac);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    // staleDays / date changes: manual refresh via button (avoid noisy calls)
  }, [staleDays, startDate, endDate]);

  const downloadCsv = async () => {
    try {
      setError(null);
      const blob = await crmReportsApi.downloadPipelineHealthCsv({ staleDays });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crm_pipeline_health_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const downloadFunnelCsv = async () => {
    try {
      setError(null);
      const blob = await crmReportsApi.downloadFunnelCsv({ startDate, endDate });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crm_funnel_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const downloadForecastCsv = async () => {
    try {
      setError(null);
      const blob = await crmReportsApi.downloadForecastCsv({ startDate, endDate });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crm_forecast_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const downloadActivityCsv = async () => {
    try {
      setError(null);
      const blob = await crmReportsApi.downloadActivityCsv({ startDate, endDate, bucket: activityBucket });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crm_activity_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const forecastTotalsList = useMemo(() => {
    const totals = forecast?.totalsByCurrency || {};
    return Object.entries(totals)
      .map(([ccy, v]) => ({ ccy, raw: Number(v?.raw) || 0, weighted: Number(v?.weighted) || 0, count: Number(v?.count) || 0 }))
      .sort((a, b) => b.weighted - a.weighted);
  }, [forecast]);

  const activityTotalsOverall = useMemo(() => {
    const totals = activity?.totalsByUser || {};
    let activitiesTotal = 0;
    let tasksCreatedTotal = 0;
    let tasksCompletedTotal = 0;
    for (const v of Object.values(totals)) {
      activitiesTotal += Number((v as any)?.activities) || 0;
      tasksCreatedTotal += Number((v as any)?.tasksCreated) || 0;
      tasksCompletedTotal += Number((v as any)?.tasksCompleted) || 0;
    }
    return { activitiesTotal, tasksCreatedTotal, tasksCompletedTotal };
  }, [activity]);

  return (
    <div className="p-4">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold">{t('crm.reports.title')}</h2>
          <p className="text-xs text-gray-500">{t('crm.reports.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="border rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50"
          disabled={loading}
        >
          {loading ? t('common.loading') : t('crm.reports.refresh')}
        </button>
      </div>

      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border rounded-xl bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">{t('crm.reports.pipelineHealth.title')}</div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">{t('crm.reports.pipelineHealth.staleDays')}</label>
              <input
                type="number"
                value={staleDays}
                min={1}
                max={3650}
                onChange={(e) => setStaleDays(Math.max(1, Math.min(3650, Number(e.target.value) || 1)))}
                className="w-20 border rounded-lg px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => void downloadCsv()}
                className="border rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50"
                disabled={loading}
              >
                {t('crm.reports.exportCsv')}
              </button>
            </div>
          </div>

          {!pipelineHealth ? (
            <div className="mt-3 text-sm text-gray-600">{loading ? t('common.loading') : '—'}</div>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-gray-500">{t('crm.reports.pipelineHealth.openDeals')}</div>
                  <div className="mt-1 text-lg font-bold text-gray-900">{pipelineHealth.openCount}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-gray-500">{t('crm.reports.pipelineHealth.staleDeals')}</div>
                  <div className="mt-1 text-lg font-bold text-gray-900">{pipelineHealth.staleDealsCount}</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs text-gray-500">{t('crm.reports.pipelineHealth.totalsByCurrency')}</div>
                <div className="mt-1 flex flex-wrap gap-3">
                  {totalsByCurrencyList.length === 0 ? (
                    <div className="text-sm text-gray-600">0</div>
                  ) : (
                    totalsByCurrencyList.map((x) => (
                      <div key={x.ccy} className="text-sm font-semibold text-gray-900">
                        {formatMoney(x.total)} {x.ccy}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b">
                      <th className="py-2 pr-4">{t('crm.reports.pipelineHealth.stage')}</th>
                      <th className="py-2 pr-4">{t('crm.reports.pipelineHealth.count')}</th>
                      <th className="py-2 pr-4">{t('crm.reports.pipelineHealth.avgAgeDays')}</th>
                      <th className="py-2 pr-4">{t('crm.reports.pipelineHealth.staleCount')}</th>
                      <th className="py-2">{t('crm.reports.pipelineHealth.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelineHealth.byStage.map((row) => {
                      const totals = Object.entries(row.totalsByCurrency || {})
                        .map(([ccy, total]) => `${formatMoney(total)} ${ccy}`)
                        .join(' · ');
                      return (
                        <tr key={row.stageId} className="border-b last:border-b-0">
                          <td className="py-2 pr-4 text-gray-900">{row.stageName}</td>
                          <td className="py-2 pr-4 text-gray-700">{row.count}</td>
                          <td className="py-2 pr-4 text-gray-700">{row.avgAgeDays}</td>
                          <td className="py-2 pr-4 text-gray-700">{row.staleCount}</td>
                          <td className="py-2 text-gray-700">{totals || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 text-xs text-gray-500">
                {t('crm.reports.pipelineHealth.winRate')}: <span className="font-semibold text-gray-900">{formatPct(pipelineHealth.winRate)}</span>
              </div>

              {pipelineHealth.winRateBreakdown?.byStage?.length ? (
                <div className="mt-4 overflow-x-auto">
                  <div className="text-xs font-semibold text-gray-500 mb-2">{t('crm.reports.pipelineHealth.winRateByStage')}</div>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b">
                        <th className="py-2 pr-4">{t('crm.reports.pipelineHealth.stage')}</th>
                        <th className="py-2 pr-4">{t('crm.reports.pipelineHealth.closed')}</th>
                        <th className="py-2">{t('crm.reports.pipelineHealth.winRate')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pipelineHealth.winRateBreakdown.byStage.map((r) => (
                        <tr key={r.stageId} className="border-b last:border-b-0">
                          <td className="py-2 pr-4 text-gray-900">{r.stageName}</td>
                          <td className="py-2 pr-4 text-gray-700">{r.total}</td>
                          <td className="py-2 text-gray-700">{formatPct(r.winRate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {pipelineHealth.winRateBreakdown?.byOwner?.length ? (
                <div className="mt-4 overflow-x-auto">
                  <div className="text-xs font-semibold text-gray-500 mb-2">{t('crm.reports.pipelineHealth.winRateByOwner')}</div>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b">
                        <th className="py-2 pr-4">{t('crm.reports.pipelineHealth.owner')}</th>
                        <th className="py-2 pr-4">{t('crm.reports.pipelineHealth.closed')}</th>
                        <th className="py-2">{t('crm.reports.pipelineHealth.winRate')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pipelineHealth.winRateBreakdown.byOwner.slice(0, 5).map((r) => (
                        <tr key={r.ownerUserId} className="border-b last:border-b-0">
                          <td className="py-2 pr-4 text-gray-900">{r.ownerUserId}</td>
                          <td className="py-2 pr-4 text-gray-700">{r.total}</td>
                          <td className="py-2 text-gray-700">{formatPct(r.winRate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-1 text-[11px] text-gray-400">{t('crm.reports.pipelineHealth.ownerNote')}</div>
                </div>
              ) : null}

              {pipelineHealth.winRateBreakdown?.byTeamMember?.length ? (
                <div className="mt-4 overflow-x-auto">
                  <div className="text-xs font-semibold text-gray-500 mb-2">{t('crm.reports.pipelineHealth.winRateByTeam')}</div>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b">
                        <th className="py-2 pr-4">{t('crm.reports.pipelineHealth.teamMember')}</th>
                        <th className="py-2 pr-4">{t('crm.reports.pipelineHealth.closed')}</th>
                        <th className="py-2">{t('crm.reports.pipelineHealth.winRate')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pipelineHealth.winRateBreakdown.byTeamMember.slice(0, 5).map((r) => (
                        <tr key={r.userId} className="border-b last:border-b-0">
                          <td className="py-2 pr-4 text-gray-900">{r.userId}</td>
                          <td className="py-2 pr-4 text-gray-700">{r.total}</td>
                          <td className="py-2 text-gray-700">{formatPct(r.winRate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-1 text-[11px] text-gray-400">{t('crm.reports.pipelineHealth.teamNote')}</div>
                </div>
              ) : null}

              <div className="mt-1 text-[11px] text-gray-400">{t('crm.reports.pipelineHealth.note')}</div>
            </>
          )}
        </div>

        <div className="border rounded-xl bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">{t('crm.reports.funnel.title')}</div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">{t('crm.reports.funnel.start')}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border rounded-lg px-2 py-1 text-sm"
              />
              <label className="text-xs text-gray-500">{t('crm.reports.funnel.end')}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border rounded-lg px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => void downloadFunnelCsv()}
                className="border rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50"
                disabled={loading}
              >
                {t('crm.reports.exportCsv')}
              </button>
            </div>
          </div>

          {!funnel ? (
            <div className="mt-3 text-sm text-gray-600">{loading ? t('common.loading') : '—'}</div>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-gray-500">{t('crm.reports.funnel.leads')}</div>
                  <div className="mt-1 text-lg font-bold text-gray-900">{funnel.counts.leads}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-gray-500">{t('crm.reports.funnel.contacts')}</div>
                  <div className="mt-1 text-lg font-bold text-gray-900">{funnel.counts.contacts}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-gray-500">{t('crm.reports.funnel.opportunities')}</div>
                  <div className="mt-1 text-lg font-bold text-gray-900">{funnel.counts.opportunities}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-gray-500">{t('crm.reports.funnel.winRate')}</div>
                  <div className="mt-1 text-lg font-bold text-gray-900">{formatPct(funnel.rates.winRate)}</div>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b">
                      <th className="py-2 pr-4">{t('crm.reports.funnel.metric')}</th>
                      <th className="py-2">{t('crm.reports.funnel.value')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 pr-4 text-gray-700">{t('crm.reports.funnel.contactPerLead')}</td>
                      <td className="py-2 text-gray-900 font-semibold">{formatPct(funnel.rates.contactPerLead)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4 text-gray-700">{t('crm.reports.funnel.opportunityPerContact')}</td>
                      <td className="py-2 text-gray-900 font-semibold">{formatPct(funnel.rates.opportunityPerContact)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 text-gray-700">{t('crm.reports.funnel.closed')}</td>
                      <td className="py-2 text-gray-900 font-semibold">{funnel.counts.won + funnel.counts.lost}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {funnel.stageTransitions ? (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-gray-500 mb-2">{t('crm.reports.funnel.stageTransitions.title')}</div>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="overflow-x-auto">
                      <div className="text-[11px] text-gray-400 mb-2">{t('crm.reports.funnel.stageTransitions.avgDaysInStage')}</div>
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-500 border-b">
                            <th className="py-2 pr-4">{t('crm.reports.pipelineHealth.stage')}</th>
                            <th className="py-2 pr-4">{t('crm.reports.funnel.stageTransitions.count')}</th>
                            <th className="py-2">{t('crm.reports.funnel.stageTransitions.avgDays')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(funnel.stageTransitions.avgDaysInStage || []).map((r) => (
                            <tr key={r.stageId} className="border-b last:border-b-0">
                              <td className="py-2 pr-4 text-gray-900">{stageNameById.get(r.stageId) || r.stageId}</td>
                              <td className="py-2 pr-4 text-gray-700">{r.count}</td>
                              <td className="py-2 text-gray-700">{Math.round((Number(r.avgDays) || 0) * 10) / 10}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {(!funnel.stageTransitions.avgDaysInStage || funnel.stageTransitions.avgDaysInStage.length === 0) ? (
                        <div className="mt-2 text-sm text-gray-600">—</div>
                      ) : null}
                    </div>

                    <div className="overflow-x-auto">
                      <div className="text-[11px] text-gray-400 mb-2">{t('crm.reports.funnel.stageTransitions.transitions')}</div>
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-500 border-b">
                            <th className="py-2 pr-4">{t('crm.reports.funnel.stageTransitions.from')}</th>
                            <th className="py-2 pr-4">{t('crm.reports.funnel.stageTransitions.to')}</th>
                            <th className="py-2 pr-4">{t('crm.reports.funnel.stageTransitions.count')}</th>
                            <th className="py-2">{t('crm.reports.funnel.stageTransitions.avgDays')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(funnel.stageTransitions.transitions || []).map((tr) => (
                            <tr key={`${tr.fromStageId ?? 'null'}-${tr.toStageId}`} className="border-b last:border-b-0">
                              <td className="py-2 pr-4 text-gray-900">{tr.fromStageId ? (stageNameById.get(tr.fromStageId) || tr.fromStageId) : '—'}</td>
                              <td className="py-2 pr-4 text-gray-900">{stageNameById.get(tr.toStageId) || tr.toStageId}</td>
                              <td className="py-2 pr-4 text-gray-700">{tr.count}</td>
                              <td className="py-2 text-gray-700">{Math.round((Number(tr.avgDays) || 0) * 10) / 10}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {(!funnel.stageTransitions.transitions || funnel.stageTransitions.transitions.length === 0) ? (
                        <div className="mt-2 text-sm text-gray-600">—</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-1 text-[11px] text-gray-400">{t('crm.reports.funnel.note')}</div>
            </>
          )}
        </div>

        <div className="border rounded-xl bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">{t('crm.reports.forecast.title')}</div>
            <button
              type="button"
              onClick={() => void downloadForecastCsv()}
              className="border rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50"
              disabled={loading}
            >
              {t('crm.reports.exportCsv')}
            </button>
          </div>

          {!forecast ? (
            <div className="mt-3 text-sm text-gray-600">{loading ? t('common.loading') : '—'}</div>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-gray-500">{t('crm.reports.forecast.rawTotal')}</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    {forecastTotalsList.map((x) => (
                      <div key={`raw-${x.ccy}`}>{formatMoney(x.raw)} {x.ccy}</div>
                    ))}
                    {forecastTotalsList.length === 0 ? '—' : null}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-gray-500">{t('crm.reports.forecast.weightedTotal')}</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    {forecastTotalsList.map((x) => (
                      <div key={`w-${x.ccy}`}>{formatMoney(x.weighted)} {x.ccy}</div>
                    ))}
                    {forecastTotalsList.length === 0 ? '—' : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b">
                      <th className="py-2 pr-4">{t('crm.reports.forecast.week')}</th>
                      <th className="py-2 pr-4">{t('crm.reports.forecast.currency')}</th>
                      <th className="py-2 pr-4">{t('crm.reports.forecast.raw')}</th>
                      <th className="py-2 pr-4">{t('crm.reports.forecast.weighted')}</th>
                      <th className="py-2">{t('crm.reports.forecast.count')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(forecast.byWeek || []).flatMap((w) => {
                      const entries = Object.entries((w as any).totalsByCurrency || {});
                      if (entries.length === 0) {
                        return (
                          <tr key={`wk-${w.week}`} className="border-b last:border-b-0">
                            <td className="py-2 pr-4 text-gray-900">{w.week}</td>
                            <td className="py-2 pr-4 text-gray-700">—</td>
                            <td className="py-2 pr-4 text-gray-700">—</td>
                            <td className="py-2 pr-4 text-gray-700">—</td>
                            <td className="py-2 text-gray-700">—</td>
                          </tr>
                        );
                      }
                      return entries.map(([ccy, v]) => (
                        <tr key={`${w.week}-${ccy}`} className="border-b last:border-b-0">
                          <td className="py-2 pr-4 text-gray-900">{w.week}</td>
                          <td className="py-2 pr-4 text-gray-700">{ccy}</td>
                          <td className="py-2 pr-4 text-gray-700">{formatMoney(Number((v as any)?.raw) || 0)}</td>
                          <td className="py-2 pr-4 text-gray-700">{formatMoney(Number((v as any)?.weighted) || 0)}</td>
                          <td className="py-2 text-gray-700">{Number((v as any)?.count) || 0}</td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-1 text-[11px] text-gray-400">{t('crm.reports.forecast.note')}</div>
            </>
          )}
        </div>

        <div className="border rounded-xl bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">{t('crm.reports.activity.title')}</div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">{t('crm.reports.activity.bucket')}</label>
              <select
                value={activityBucket}
                onChange={(e) => setActivityBucket(e.target.value as 'day' | 'week')}
                className="border rounded-lg px-2 py-1 text-sm bg-white"
                disabled={loading}
              >
                <option value="day">{t('crm.reports.activity.day')}</option>
                <option value="week">{t('crm.reports.activity.week')}</option>
              </select>
              <button
                type="button"
                onClick={() => void refresh()}
                className="border rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50"
                disabled={loading}
              >
                {loading ? t('common.loading') : t('crm.reports.refresh')}
              </button>
              <button
                type="button"
                onClick={() => void downloadActivityCsv()}
                className="border rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50"
                disabled={loading}
              >
                {t('crm.reports.exportCsv')}
              </button>
            </div>
          </div>

          {!activity ? (
            <div className="mt-3 text-sm text-gray-600">{loading ? t('common.loading') : '—'}</div>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-gray-500">{t('crm.reports.activity.activities')}</div>
                  <div className="mt-1 text-lg font-bold text-gray-900">{activityTotalsOverall.activitiesTotal}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-gray-500">{t('crm.reports.activity.tasksCreated')}</div>
                  <div className="mt-1 text-lg font-bold text-gray-900">{activityTotalsOverall.tasksCreatedTotal}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-gray-500">{t('crm.reports.activity.tasksCompleted')}</div>
                  <div className="mt-1 text-lg font-bold text-gray-900">{activityTotalsOverall.tasksCompletedTotal}</div>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b">
                      <th className="py-2 pr-4">{t('crm.reports.activity.bucketStart')}</th>
                      <th className="py-2 pr-4">{t('crm.reports.activity.activities')}</th>
                      <th className="py-2 pr-4">{t('crm.reports.activity.tasksCreated')}</th>
                      <th className="py-2">{t('crm.reports.activity.tasksCompleted')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activity.series || []).map((r) => (
                      <tr key={r.bucketStart} className="border-b last:border-b-0">
                        <td className="py-2 pr-4 text-gray-900">{r.bucketStart}</td>
                        <td className="py-2 pr-4 text-gray-700">{r.activities}</td>
                        <td className="py-2 pr-4 text-gray-700">{r.tasksCreated}</td>
                        <td className="py-2 text-gray-700">{r.tasksCompleted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-1 text-[11px] text-gray-400">{t('crm.reports.activity.note')}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
