import React from 'react';
import { useTranslation } from 'react-i18next';
import * as crmApi from '../../api/crm';

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

        const board = await crmApi.getBoard();
        const opportunities = Array.isArray(board?.opportunities) ? board.opportunities : [];
        const stages = Array.isArray(board?.stages) ? board.stages : [];

        const openOpps = opportunities.filter(o => (o.status || 'open') === 'open');

        const stageNameById = new Map<string, string>(stages.map(s => [s.id, s.name]));
        const counts = new Map<string, number>();
        for (const opp of openOpps) {
          const stageName = stageNameById.get(opp.stageId) || t('summary.crm.unknownStage', { defaultValue: 'Bilinmeyen' });
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
          setError(e?.message ? String(e.message) : 'CRM verisi alınamadı');
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
        <div className="text-sm font-semibold text-gray-900">{t('summary.blocks.crmFlow', { defaultValue: 'CRM Akışı' })}</div>
        <div className="text-xs text-gray-500">
          {isLoading
            ? t('summary.loading', { defaultValue: 'Yükleniyor…' })
            : t('summary.crm.openDeals', { defaultValue: 'Açık deal' })}:
          <span className="ml-1 font-semibold text-gray-900">{openCount}</span>
        </div>
      </div>

      {error ? (
        <div className="mt-3 text-sm text-red-600">{error}</div>
      ) : (
        <>
          <div className="mt-3 rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-gray-500">{t('summary.crm.expectedAmount', { defaultValue: 'Beklenen tutar' })}</div>
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
              <div className="text-sm text-gray-500">{t('summary.crm.noStageData', { defaultValue: 'Stage kırılımı yok.' })}</div>
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
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-gray-900">{t('sidebar.crmDashboard', { defaultValue: 'CRM Dashboard' })}</div>
        <div className="mt-2 text-sm text-gray-500">
          {t('crm.dashboard.subtitle', { defaultValue: 'Pipeline ve aktiviteler için özet görünüm.' })}
        </div>
      </div>

      <CrmDashboardCard />

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-gray-900">{t('summary.blocks.latestActivities', { defaultValue: 'Son Aktiviteler / Takipler' })}</div>
        <div className="mt-2 text-sm text-gray-500">
          {t('summary.latestActivitiesPlaceholder', { defaultValue: 'Bu blok için CRM aktiviteleri entegrasyonu sırada.' })}
        </div>
      </div>
    </div>
  );
}
