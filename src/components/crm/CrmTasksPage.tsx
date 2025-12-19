import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../utils/errorHandler';
import * as tasksApi from '../../api/crm-tasks';
import * as crmApi from '../../api/crm';
import { parseLocalObject, safeSessionStorage } from '../../utils/localStorageSafe';
import Pagination from '../Pagination';
import SavedViewsBar from '../SavedViewsBar';

type StoredPageState = {
  query?: string;
  statusFilter?: string;
  startDate?: string;
  endDate?: string;
  sortKey?: string;
  limit?: number;
  offset?: number;
};

const PAGE_STATE_KEY = 'crm.tasks.pageState.v1';

const readPageState = (): StoredPageState | null => {
  const raw = safeSessionStorage.getItem(PAGE_STATE_KEY);
  const parsed = parseLocalObject<StoredPageState>(raw, PAGE_STATE_KEY);
  if (!parsed) return null;
  return parsed;
};

type TaskStatusFilter = 'all' | 'open' | 'completed';

type TaskSortKey = 'updatedDesc' | 'updatedAsc' | 'createdDesc' | 'createdAsc' | 'titleAsc' | 'titleDesc';

type TaskFormState = {
  title: string;
  dueAt: string;
  completed: boolean;
  assigneeUserId: string;
};

const emptyForm: TaskFormState = {
  title: '',
  dueAt: '',
  completed: false,
  assigneeUserId: '',
};

export default function CrmTasksPage(props: {
  opportunityId?: string;
  accountId?: string;
  dealName?: string;
  accountName?: string;
  assignees?: Array<{ id: string; label: string }>;
}) {
  const { t, i18n } = useTranslation('common');

  const opportunityId = props.opportunityId;
  const accountId = props.accountId;
  const dealName = props.dealName;
  const accountName = props.accountName;

  const [resolvedDealName, setResolvedDealName] = useState<string>('');

  const effectiveDealName = String(dealName ?? '').trim() ? String(dealName ?? '') : resolvedDealName;

  const globalMode = !opportunityId && !accountId;

  const restored = useMemo(() => (globalMode ? readPageState() : null), []);

  useEffect(() => {
    const id = String(opportunityId ?? '').trim();
    if (!id) {
      setResolvedDealName('');
      return;
    }
    if (String(dealName ?? '').trim()) {
      setResolvedDealName('');
      return;
    }

    let cancelled = false;
    const loadOpportunityLabel = async () => {
      try {
        const opp = await crmApi.getOpportunity(id);
        if (!cancelled) setResolvedDealName(String(opp?.name ?? ''));
      } catch {
        if (!cancelled) setResolvedDealName('');
      }
    };
    void loadOpportunityLabel();
    return () => {
      cancelled = true;
    };
  }, [opportunityId, dealName]);

  const [items, setItems] = useState<tasksApi.CrmTask[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [editing, setEditing] = useState<tasksApi.CrmTask | null>(null);
  const [form, setForm] = useState<TaskFormState>(emptyForm);

  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<tasksApi.CrmTask | null>(null);

  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>(() => {
    const v = restored?.statusFilter;
    const allowed: TaskStatusFilter[] = ['all', 'open', 'completed'];
    return typeof v === 'string' && (allowed as string[]).includes(v)
      ? (v as TaskStatusFilter)
      : 'all';
  });

  const [sortKey, setSortKey] = useState<TaskSortKey>(() => {
    const v = restored?.sortKey;
    const allowed: TaskSortKey[] = ['updatedDesc', 'updatedAsc', 'createdDesc', 'createdAsc', 'titleAsc', 'titleDesc'];
    return typeof v === 'string' && (allowed as string[]).includes(v)
      ? (v as TaskSortKey)
      : 'updatedDesc';
  });

  const [query, setQuery] = useState(() => (typeof restored?.query === 'string' ? restored.query : ''));

  const [startDate, setStartDate] = useState(() => (typeof restored?.startDate === 'string' ? restored.startDate : ''));
  const [endDate, setEndDate] = useState(() => (typeof restored?.endDate === 'string' ? restored.endDate : ''));

  const [limit, setLimit] = useState(() => {
    const v = restored?.limit;
    const allowed = [20, 50, 100];
    return typeof v === 'number' && Number.isFinite(v) && allowed.includes(v) ? v : 20;
  });
  const [offset, setOffset] = useState(() => {
    const v = restored?.offset;
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  });

  useEffect(() => {
    if (!globalMode) return;
    safeSessionStorage.setItem(
      PAGE_STATE_KEY,
      JSON.stringify({ query, statusFilter, startDate, endDate, sortKey, limit, offset } satisfies StoredPageState),
    );
  }, [globalMode, query, statusFilter, startDate, endDate, sortKey, limit, offset]);

  const reload = async () => {
    setError(null);
    setLoading(true);
    try {
      const statusParam =
        statusFilter === 'completed'
          ? ('completed' as const)
          : statusFilter === 'open'
            ? ('open' as const)
            : undefined;

      const q = query.trim() ? query.trim() : undefined;

      const sort = (() => {
        switch (sortKey) {
          case 'updatedAsc':
            return { sortBy: 'updatedAt' as const, sortDir: 'asc' as const };
          case 'createdDesc':
            return { sortBy: 'createdAt' as const, sortDir: 'desc' as const };
          case 'createdAsc':
            return { sortBy: 'createdAt' as const, sortDir: 'asc' as const };
          case 'titleAsc':
            return { sortBy: 'title' as const, sortDir: 'asc' as const };
          case 'titleDesc':
            return { sortBy: 'title' as const, sortDir: 'desc' as const };
          case 'updatedDesc':
          default:
            return { sortBy: 'updatedAt' as const, sortDir: 'desc' as const };
        }
      })();

      const data = await tasksApi.listCrmTasks(
        opportunityId
          ? {
              opportunityId,
              q,
              startDate: startDate || undefined,
              endDate: endDate || undefined,
              sortBy: sort.sortBy,
              sortDir: sort.sortDir,
              status: statusParam,
              limit,
              offset,
            }
          : accountId
            ? {
                accountId,
                q,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                sortBy: sort.sortBy,
                sortDir: sort.sortDir,
                status: statusParam,
                limit,
                offset,
              }
            : {
                q,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                sortBy: sort.sortBy,
                sortDir: sort.sortDir,
                status: statusParam,
                limit,
                offset,
              },
      );

      const nextItems = Array.isArray(data?.items) ? data.items : [];
      setItems(nextItems);
      setTotal(typeof data?.total === 'number' ? data.total : nextItems.length);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [opportunityId, accountId, statusFilter, query, startDate, endDate, sortKey, limit, offset]);

  useEffect(() => {
    setStatusFilter('all');
  }, [opportunityId, accountId]);

  useEffect(() => {
    setQuery('');
  }, [opportunityId, accountId]);

  useEffect(() => {
    setOffset(0);
  }, [opportunityId, accountId, statusFilter, query, startDate, endDate, sortKey, limit]);

  const parseDateMs = (value: string | null | undefined): number | null => {
    const raw = String(value ?? '').trim();
    if (!raw) return null;

    const isoMatch = raw.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]);
      const day = Number(isoMatch[3]);
      if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
        return Date.UTC(year, month - 1, day);
      }
    }

    const dmyMatch = raw.match(/^([0-9]{1,2})[./-]([0-9]{1,2})[./-]([0-9]{4})$/);
    if (dmyMatch) {
      const day = Number(dmyMatch[1]);
      const month = Number(dmyMatch[2]);
      const year = Number(dmyMatch[3]);
      if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
        return Date.UTC(year, month - 1, day);
      }
    }

    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const formatDateLabel = (value: string | null | undefined, fallbackIso: string | null | undefined): string => {
    const ms = parseDateMs(value);
    if (ms != null) {
      return new Intl.DateTimeFormat(i18n.language, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(ms));
    }
    const raw = String(value ?? '').trim();
    if (raw) return raw;
    const fallbackMs = parseDateMs(fallbackIso);
    if (fallbackMs != null) {
      return new Intl.DateTimeFormat(i18n.language, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(fallbackMs));
    }
    return '';
  };

  const rows = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const hasNoResults = !loading && !error && total > 0 && rows.length === 0;
  const pageNumber = Math.floor(offset / limit) + 1;

  const openCreate = () => {
    if (globalMode) return;
    setModalError(null);
    setEditing(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (task: tasksApi.CrmTask) => {
    setModalError(null);
    setEditing(task);
    setForm({
      title: task.title ?? '',
      dueAt: task.dueAt ?? '',
      completed: !!task.completed,
      assigneeUserId: task.assigneeUserId ?? '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
  };

  const submit = async () => {
    setModalError(null);
    const title = form.title.trim();
    if (!title) {
      setModalError(t('crm.validation.titleRequired'));
      return;
    }

    const payload: tasksApi.CreateCrmTaskDto = {
      title,
      opportunityId: opportunityId || null,
      accountId: accountId || null,
      dueAt: form.dueAt.trim() ? form.dueAt.trim() : null,
      completed: !!form.completed,
      assigneeUserId: form.assigneeUserId ? form.assigneeUserId : null,
    };

    try {
      setSaving(true);
      if (editing) {
        await tasksApi.updateCrmTask(editing.id, payload);
      } else {
        await tasksApi.createCrmTask(payload);
      }
      await reload();
      setIsModalOpen(false);
    } catch (e) {
      setModalError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const startDelete = (task: tasksApi.CrmTask) => {
    setDeleteTarget(task);
  };

  const cancelDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await tasksApi.deleteCrmTask(deleteTarget.id);
      await reload();
      setDeleteTarget(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">{t('crm.tasks.title')}</div>
          {opportunityId && (
            <div className="mt-2 text-sm text-gray-500">{t('crm.tasks.subtitleForDeal', { dealName: effectiveDealName || '' })}</div>
          )}
          {!opportunityId && accountId && (
            <div className="mt-2 text-sm text-gray-500">{t('crm.tasks.subtitleForAccount', { accountName: accountName || '' })}</div>
          )}
        </div>
        {!globalMode && (
          <button
            type="button"
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
          >
            {t('common.add')}
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`${t('common.search')}...`}
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TaskStatusFilter)}
          className="w-full lg:w-64 border rounded-lg px-3 py-2 text-sm border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
          aria-label={t('crm.tasks.filters.all') as string}
        >
          <option value="all">{t('crm.tasks.filters.all')}</option>
          <option value="open">{t('crm.tasks.filters.open')}</option>
          <option value="completed">{t('crm.tasks.filters.completed')}</option>
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as TaskSortKey)}
          className="w-full lg:w-64 border rounded-lg px-3 py-2 text-sm border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
          aria-label={t('app.sort.label') as string}
        >
          <option value="updatedDesc">{t('app.sort.updatedDesc')}</option>
          <option value="updatedAsc">{t('app.sort.updatedAsc')}</option>
          <option value="createdDesc">{t('app.sort.createdDesc')}</option>
          <option value="createdAsc">{t('app.sort.createdAsc')}</option>
          <option value="titleAsc">{t('app.sort.titleAsc')}</option>
          <option value="titleDesc">{t('app.sort.titleDesc')}</option>
        </select>

        {globalMode && (
          <div className="lg:ml-auto flex items-center">
            <SavedViewsBar
              listType="crm_tasks"
              getState={() => ({ query, statusFilter, startDate, endDate, sortKey, pageSize: limit })}
              applyState={(state) => {
                if (!state) return;
                setQuery(state.query ?? '');
                if (typeof state.statusFilter === 'string') {
                  const allowed: TaskStatusFilter[] = ['all', 'open', 'completed'];
                  setStatusFilter((allowed as string[]).includes(state.statusFilter) ? (state.statusFilter as TaskStatusFilter) : 'all');
                } else {
                  setStatusFilter('all');
                }
                setStartDate(state.startDate ?? '');
                setEndDate(state.endDate ?? '');
                if (typeof state.sortKey === 'string') {
                  const allowed: TaskSortKey[] = ['updatedDesc', 'updatedAsc', 'createdDesc', 'createdAsc', 'titleAsc', 'titleDesc'];
                  if ((allowed as string[]).includes(state.sortKey)) setSortKey(state.sortKey as TaskSortKey);
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
                { id: 'open', label: t('crm.tasks.filters.open') as string, apply: () => setStatusFilter('open') },
                {
                  id: 'completed',
                  label: t('crm.tasks.filters.completed') as string,
                  apply: () => setStatusFilter('completed'),
                },
              ]}
            />
          </div>
        )}
      </div>

      {loading && <div className="mt-4 text-sm text-gray-600">{t('common.loading')}</div>}
      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}



      {!loading && !error && hasNoResults && (
        <div className="mt-6 text-sm text-gray-600">{t('common.noResults')}</div>
      )}

      {!loading && !error && !hasNoResults && total === 0 && (
        <div className="mt-6 text-sm text-gray-600">{t('crm.tasks.empty')}</div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2 pr-4">{t('crm.fields.title')}</th>
                <th className="py-2 pr-4">{t('crm.fields.assignee')}</th>
                <th className="py-2 pr-4">{t('crm.fields.dueAt')}</th>
                <th className="py-2 pr-4">{t('crm.fields.completed')}</th>
                <th className="py-2">{t('crm.fields.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((task) => (
                <tr key={task.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 text-gray-900">{task.title}</td>
                  <td className="py-2 pr-4 text-gray-700">
                    {(() => {
                      const label = (props.assignees ?? []).find((a) => a.id === task.assigneeUserId)?.label;
                      return label || (task.assigneeUserId ? task.assigneeUserId : '-');
                    })()}
                  </td>
                  <td className="py-2 pr-4 text-gray-700">{formatDateLabel(task.dueAt, task.createdAt) || '-'}</td>
                  <td className="py-2 pr-4 text-gray-700">{task.completed ? t('common.yes') : t('common.no')}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => openEdit(task)} className="text-blue-600 hover:underline">
                        {t('common.edit')}
                      </button>
                      <button type="button" onClick={() => startDelete(task)} className="text-red-600 hover:underline">
                        {t('common.delete')}
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editing ? t('crm.tasks.modal.editTitle') : t('crm.tasks.modal.createTitle')}
            </h3>

            {modalError && <div className="mb-4 text-sm text-red-600">{modalError}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.fields.title')}</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.fields.assignee')}</label>
                <select
                  value={form.assigneeUserId}
                  onChange={(e) => setForm((p) => ({ ...p, assigneeUserId: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300"
                >
                  <option value="">{t('crm.tasks.unassigned')}</option>
                  {(props.assignees ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.fields.dueAt')}</label>
                <input
                  type="text"
                  value={form.dueAt}
                  onChange={(e) => setForm((p) => ({ ...p, dueAt: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300"
                  placeholder={t('crm.tasks.dueAtPlaceholder')}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="crm-task-completed"
                  type="checkbox"
                  checked={form.completed}
                  onChange={(e) => setForm((p) => ({ ...p, completed: e.target.checked }))}
                  className="h-4 w-4"
                />
                <label htmlFor="crm-task-completed" className="text-sm text-gray-700">
                  {t('crm.fields.completed')}
                </label>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50"
                disabled={saving}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={submit}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
                disabled={saving}
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('crm.confirmDelete.title')}</h3>
            <p className="text-sm text-gray-600 mb-6">{t('crm.confirmDelete.message', { name: deleteTarget.title })}</p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={cancelDelete}
                className="px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50"
                disabled={deleting}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm"
                disabled={deleting}
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
