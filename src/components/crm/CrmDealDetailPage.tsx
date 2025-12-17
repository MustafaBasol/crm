import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import * as crmApi from '../../api/crm';
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

  const [saving, setSaving] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [movingStage, setMovingStage] = useState(false);

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
    } catch (e) {
      setError(getErrorMessage(e));
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

      <CrmActivitiesPage opportunityId={opportunity.id} dealName={opportunity.name} />

      <div className="mt-6">
        <CrmTasksPage opportunityId={opportunity.id} dealName={opportunity.name} assignees={taskAssignees} />
      </div>
    </div>
  );
}
