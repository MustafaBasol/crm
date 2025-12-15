import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import * as crmApi from '../../api/crm';
import { Currency, useCurrency } from '../../contexts/CurrencyContext';
import { getCustomers, Customer } from '../../api/customers';
import { organizationsApi, OrganizationMember } from '../../api/organizations';
import { useAuth } from '../../contexts/AuthContext';

export default function CrmPipelineBoardPage() {
  const { t } = useTranslation('common');
  const { formatCurrency, currency: defaultCurrency } = useCurrency();
  const { user } = useAuth();

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
  const [board, setBoard] = useState<crmApi.CrmBoardResponse | null>(null);

  const pipelineLabel = useMemo(() => {
    const name = board?.pipeline?.name;
    if (!name) return t('crm.pipeline.title') as string;
    const normalized = String(name).trim().toLowerCase();
    if (normalized === 'default pipeline') return t('crm.pipeline.defaultName') as string;
    return name;
  }, [board?.pipeline?.name, t]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [movingOppId, setMovingOppId] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<{
    name: string;
    accountId: string;
    amount: string;
    currency: Currency;
    expectedCloseDate: string;
    stageId: string;
    teamUserIds: string[];
  }>({
    name: '',
    accountId: '',
    amount: '',
    currency: defaultCurrency,
    expectedCloseDate: '',
    stageId: '',
    teamUserIds: user?.id ? [user.id] : [],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // tek pipeline şimdilik: yoksa bootstrap et
        await crmApi.bootstrapPipeline();
        const data = await crmApi.getBoard();
        if (!cancelled) setBoard(data);
      } catch (e) {
        const msg = getErrorMessage(e);
        logger.error('crm.board.loadFailed', e);
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const reloadBoard = async () => {
    const data = await crmApi.getBoard();
    setBoard(data);
  };

  const stages: crmApi.CrmStage[] = board?.stages ?? [];
  const opportunities: crmApi.CrmOpportunity[] = board?.opportunities ?? [];

  useEffect(() => {
    if (!showCreateModal) return;
    if (createForm.stageId) return;
    const firstStageId = stages[0]?.id;
    if (!firstStageId) return;
    setCreateForm((prev) => ({ ...prev, stageId: firstStageId }));
  }, [showCreateModal, stages]);

  useEffect(() => {
    let cancelled = false;
    if (!showCreateModal) return;

    (async () => {
      setCreateError(null);
      try {
        const [customersData, orgs] = await Promise.all([
          getCustomers(),
          organizationsApi.getAll(),
        ]);
        if (cancelled) return;
        setCustomers(customersData ?? []);

        const org = (orgs ?? [])[0];
        if (!org?.id) {
          setMembers([]);
          return;
        }
        const membersData = await organizationsApi.getMembers(org.id);
        if (!cancelled) setMembers(membersData ?? []);
      } catch (e) {
        if (!cancelled) setCreateError(getErrorMessage(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showCreateModal]);

  const oppByStage = useMemo(() => {
    const map = new Map<string, crmApi.CrmOpportunity[]>();
    for (const s of stages) map.set(s.id, []);
    for (const o of opportunities) {
      const list = map.get(o.stageId) ?? [];
      list.push(o);
      map.set(o.stageId, list);
    }
    return map;
  }, [stages, opportunities]);

  const openCreate = () => {
    setCreateError(null);
    setCreateForm({
      name: '',
      accountId: '',
      amount: '',
      currency: defaultCurrency,
      expectedCloseDate: '',
      stageId: stages[0]?.id ?? '',
      teamUserIds: user?.id ? [user.id] : [],
    });
    setShowCreateModal(true);
  };

  const closeCreate = () => {
    setShowCreateModal(false);
  };

  const toggleTeamUser = (userId: string) => {
    setCreateForm((prev) => {
      const has = prev.teamUserIds.includes(userId);
      const next = has ? prev.teamUserIds.filter((id) => id !== userId) : [...prev.teamUserIds, userId];
      return { ...prev, teamUserIds: next };
    });
  };

  const submitCreate = async () => {
    setCreateError(null);
    const name = createForm.name.trim();
    if (!name) {
      setCreateError(t('crm.pipeline.validation.nameRequired') as string);
      return;
    }
    if (!createForm.accountId) {
      setCreateError(t('crm.pipeline.validation.accountRequired') as string);
      return;
    }

    const amount = Number(createForm.amount || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      setCreateError(t('crm.pipeline.validation.amountInvalid') as string);
      return;
    }

    const ensuredOwnerTeam = Array.from(
      new Set([
        ...(createForm.teamUserIds ?? []),
        ...(user?.id ? [user.id] : []),
      ]),
    );

    try {
      setCreating(true);
      await crmApi.createOpportunity({
        accountId: createForm.accountId,
        name,
        amount,
        currency: createForm.currency,
        expectedCloseDate: createForm.expectedCloseDate || undefined,
        stageId: createForm.stageId || undefined,
        teamUserIds: ensuredOwnerTeam,
      });
      await reloadBoard();
      closeCreate();
    } catch (e) {
      setCreateError(getErrorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold">{t('sidebar.crm')}</h2>
        <p className="text-sm text-gray-600">{t('crm.pipeline.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold">{t('sidebar.crm')}</h2>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">{t('sidebar.crm')}</h2>
          <p className="text-xs text-gray-500">{pipelineLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">{t('crm.pipeline.visibilityOwnerAndTeam')}</div>
          <button
            type="button"
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
          >
            {t('crm.pipeline.addOpportunity')}
          </button>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('crm.pipeline.createTitle')}</h3>

            {createError && (
              <div className="mb-4 text-sm text-red-600">{createError}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.pipeline.fields.opportunityName')}</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.pipeline.fields.account')}</label>
                <select
                  value={createForm.accountId}
                  onChange={(e) => setCreateForm((p) => ({ ...p, accountId: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300"
                  required
                >
                  <option value="">{t('crm.pipeline.selectPlaceholder')}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.pipeline.fields.amount')}</label>
                  <input
                    type="number"
                    value={createForm.amount}
                    onChange={(e) => setCreateForm((p) => ({ ...p, amount: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 border-gray-300"
                    min={0}
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.pipeline.fields.currency')}</label>
                  <select
                    value={createForm.currency}
                    onChange={(e) => setCreateForm((p) => ({ ...p, currency: e.target.value as Currency }))}
                    className="w-full border rounded-lg px-3 py-2 border-gray-300"
                  >
                    <option value="TRY">TRY</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.pipeline.fields.expectedCloseDate')}</label>
                  <input
                    type="date"
                    value={createForm.expectedCloseDate}
                    onChange={(e) => setCreateForm((p) => ({ ...p, expectedCloseDate: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.pipeline.fields.stage')}</label>
                  <select
                    value={createForm.stageId}
                    onChange={(e) => setCreateForm((p) => ({ ...p, stageId: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 border-gray-300"
                    disabled={stages.length === 0}
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {stageLabel(s)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.pipeline.fields.team')}</label>
                <div className="border rounded-lg p-3 max-h-48 overflow-auto">
                  {members.length === 0 && (
                    <div className="text-sm text-gray-500">{t('crm.pipeline.noMembers')}</div>
                  )}
                  <div className="space-y-2">
                    {members.map((m) => {
                      const memberUserId = m.user.id;
                      const isOwner = user?.id && memberUserId === user.id;
                      const checked = createForm.teamUserIds.includes(memberUserId) || !!isOwner;
                      return (
                        <label key={m.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!!isOwner}
                            onChange={() => toggleTeamUser(memberUserId)}
                          />
                          <span className="text-gray-800">
                            {m.user.firstName} {m.user.lastName} ({m.user.email})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {user?.id && (
                    <div className="mt-2 text-xs text-gray-500">{t('crm.pipeline.ownerAutoInTeam')}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-5">
              <button
                type="button"
                onClick={closeCreate}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                disabled={creating}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={submitCreate}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={creating}
              >
                {creating ? t('crm.pipeline.saving') : t('common.add')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stages.map((stage: crmApi.CrmStage) => {
          const list = oppByStage.get(stage.id) ?? [];
          return (
            <div key={stage.id} className="border rounded bg-white">
              <div className="px-3 py-2 border-b">
                <div className="text-sm font-medium">{stageLabel(stage)}</div>
                <div className="text-xs text-gray-500">{t('crm.pipeline.opportunityCount', { count: list.length })}</div>
              </div>
              <div className="p-2 space-y-2">
                {list.map((opp: crmApi.CrmOpportunity) => (
                  <div key={opp.id} className="border rounded p-2">
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          window.location.hash = `crm-deal:${opp.id}`;
                        } catch {
                          // ignore
                        }
                      }}
                      className="text-sm font-medium truncate text-left w-full text-blue-600 hover:underline"
                    >
                      {opp.name}
                    </button>
                    <div className="text-xs text-gray-600">
                      {formatCurrency(Number(opp.amount ?? 0), (opp.currency as any) ?? 'TRY')}
                    </div>
                    <div className="text-[11px] text-gray-500">Takım: {opp.teamUserIds?.length ?? 0}</div>

                    <div className="mt-2">
                      <label className="block text-[11px] text-gray-500 mb-1">{t('crm.pipeline.fields.stage')}</label>
                      <select
                        value={opp.stageId}
                        disabled={movingOppId === opp.id}
                        onChange={async (e) => {
                          const nextStageId = e.target.value;
                          if (!nextStageId || nextStageId === opp.stageId) return;
                          setError(null);
                          try {
                            setMovingOppId(opp.id);
                            await crmApi.moveOpportunity(opp.id, nextStageId);
                            await reloadBoard();
                          } catch (err) {
                            setError(getErrorMessage(err));
                          } finally {
                            setMovingOppId(null);
                          }
                        }}
                        className="w-full border rounded px-2 py-1 text-sm border-gray-300"
                      >
                        {stages.map((s) => (
                          <option key={s.id} value={s.id}>
                            {stageLabel(s)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
                {list.length === 0 && (
                  <div className="text-xs text-gray-400 p-2">{t('crm.pipeline.empty')}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
