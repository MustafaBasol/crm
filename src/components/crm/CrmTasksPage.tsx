import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../utils/errorHandler';
import * as tasksApi from '../../api/crm-tasks';

type TaskStatusFilter = 'all' | 'open' | 'completed';

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

  const globalMode = !opportunityId && !accountId;

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

  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');

  const [limit] = useState(25);
  const [offset, setOffset] = useState(0);

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

      const data = await tasksApi.listCrmTasks(
        opportunityId
          ? { opportunityId, status: statusParam, limit, offset }
          : accountId
            ? { accountId, status: statusParam, limit, offset }
            : { status: statusParam, limit, offset },
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
  }, [opportunityId, accountId, statusFilter, limit, offset]);

  useEffect(() => {
    setStatusFilter('all');
  }, [opportunityId, accountId]);

  useEffect(() => {
    setOffset(0);
  }, [opportunityId, accountId, statusFilter, limit]);

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
  const canPrev = offset > 0;
  const canNext = offset + rows.length < total;

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
            <div className="mt-2 text-sm text-gray-500">{t('crm.tasks.subtitleForDeal', { dealName: dealName || '' })}</div>
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

      {loading && <div className="mt-4 text-sm text-gray-600">{t('common.loading')}</div>}
      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      {!loading && !error && total > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => setOffset((v) => Math.max(0, v - limit))}
            className={
              canPrev
                ? 'px-3 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50'
                : 'px-3 py-2 rounded-lg text-sm border border-gray-200 text-gray-400 cursor-not-allowed'
            }
          >
            {t('common.previous')}
          </button>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setOffset((v) => v + limit)}
            className={
              canNext
                ? 'px-3 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50'
                : 'px-3 py-2 rounded-lg text-sm border border-gray-200 text-gray-400 cursor-not-allowed'
            }
          >
            {t('common.next')}
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(
            [
              { key: 'all' as const, label: t('crm.tasks.filters.all') },
              { key: 'open' as const, label: t('crm.tasks.filters.open') },
              { key: 'completed' as const, label: t('crm.tasks.filters.completed') },
            ] as const
          ).map((opt) => {
            const active = statusFilter === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setStatusFilter(opt.key)}
                className={
                  active
                    ? 'px-3 py-1 rounded-full text-xs bg-blue-600 text-white'
                    : 'px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

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
