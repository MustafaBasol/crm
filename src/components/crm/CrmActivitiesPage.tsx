import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../utils/errorHandler';
import * as activitiesApi from '../../api/crm-activities';
import * as contactsApi from '../../api/crm-contacts';

type ActivityStatusFilter = 'all' | 'open' | 'completed';

type ActivityFormState = {
  title: string;
  type: string;
  dueAt: string;
  completed: boolean;
  contactId: string;
};

const emptyForm: ActivityFormState = {
  title: '',
  type: '',
  dueAt: '',
  completed: false,
  contactId: '',
};

export default function CrmActivitiesPage(
  props: {
    opportunityId?: string;
    dealName?: string;
    contactId?: string;
    contactName?: string;
    accountId?: string;
    accountName?: string;
  } = {},
) {
  const { t, i18n } = useTranslation('common');

  const opportunityId = props?.opportunityId;
  const dealName = props?.dealName;
  const contactId = props?.contactId;
  const contactName = props?.contactName;
  const accountId = props?.accountId;
  const accountName = props?.accountName;

  const scope: 'opportunity' | 'contact' | 'account' | 'global' = opportunityId
    ? 'opportunity'
    : contactId
      ? 'contact'
      : accountId
        ? 'account'
        : 'global';

  const isScopedTimeline = scope !== 'global';

  const [items, setItems] = useState<activitiesApi.CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [contacts, setContacts] = useState<contactsApi.CrmContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [editing, setEditing] = useState<activitiesApi.CrmActivity | null>(null);
  const [form, setForm] = useState<ActivityFormState>(emptyForm);

  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<activitiesApi.CrmActivity | null>(null);

  const [statusFilter, setStatusFilter] = useState<ActivityStatusFilter>('all');

  const canPickContactInModal =
    scope === 'global' && !(editing?.opportunityId || editing?.accountId);

  const reload = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await activitiesApi.listCrmActivities(
        scope === 'opportunity'
          ? { opportunityId: opportunityId as string }
          : scope === 'contact'
            ? { contactId: contactId as string }
            : scope === 'account'
              ? { accountId: accountId as string }
              : undefined,
      );
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [opportunityId, contactId, accountId]);

  useEffect(() => {
    setStatusFilter('all');
  }, [opportunityId, contactId, accountId]);

  useEffect(() => {
    if (scope !== 'global') return;
    let cancelled = false;
    const loadContacts = async () => {
      try {
        setContactsLoading(true);
        const data = await contactsApi.listCrmContacts();
        if (!cancelled) setContacts(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setContacts([]);
      } finally {
        if (!cancelled) setContactsLoading(false);
      }
    };
    void loadContacts();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const parseDateMs = (value: string | null | undefined): number | null => {
    const raw = String(value ?? '').trim();
    if (!raw) return null;

    // Fast paths for common date-only formats used in UI placeholders
    // ISO date: 2025-12-15
    const isoMatch = raw.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]);
      const day = Number(isoMatch[3]);
      if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
        return Date.UTC(year, month - 1, day);
      }
    }

    // TR/EU: 15.12.2025 or 15/12/2025 (also allow '-')
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

  const openCreate = () => {
    setModalError(null);
    setEditing(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (activity: activitiesApi.CrmActivity) => {
    setModalError(null);
    setEditing(activity);
    setForm({
      title: activity.title ?? '',
      type: activity.type ?? '',
      dueAt: activity.dueAt ?? '',
      completed: !!activity.completed,
      contactId: activity.contactId ?? '',
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

    const payload: activitiesApi.CreateCrmActivityDto = {
      title,
      type: form.type.trim() || undefined,
      opportunityId: scope === 'opportunity' ? (opportunityId as string) : undefined,
      accountId: scope === 'account' ? (accountId as string) : undefined,
      contactId:
        scope === 'contact'
          ? (contactId as string)
          : scope === 'opportunity'
            ? undefined
            : scope === 'account'
              ? null
              : canPickContactInModal
                ? form.contactId
                  ? form.contactId
                  : null
                : null,
      dueAt: form.dueAt.trim() ? form.dueAt.trim() : null,
      completed: !!form.completed,
    };

    try {
      setSaving(true);
      if (editing) {
        await activitiesApi.updateCrmActivity(editing.id, payload);
      } else {
        await activitiesApi.createCrmActivity(payload);
      }
      await reload();
      setIsModalOpen(false);
    } catch (e) {
      setModalError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const startDelete = (activity: activitiesApi.CrmActivity) => {
    setDeleteTarget(activity);
  };

  const cancelDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await activitiesApi.deleteCrmActivity(deleteTarget.id);
      await reload();
      setDeleteTarget(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  const rows = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  const timelineRows = useMemo(() => {
    const base = Array.isArray(rows) ? [...rows] : [];
    const filtered = isScopedTimeline
      ? base.filter((a) => {
          if (statusFilter === 'completed') return !!a.completed;
          if (statusFilter === 'open') return !a.completed;
          return true;
        })
      : base;

    const sortKey = (a: activitiesApi.CrmActivity): number => {
      return parseDateMs(a.dueAt) ?? parseDateMs(a.createdAt) ?? 0;
    };

    filtered.sort((a, b) => sortKey(b) - sortKey(a));
    return filtered;
  }, [isScopedTimeline, rows, statusFilter]);

  const timelineGroups = useMemo(() => {
    const groups = new Map<string, { header: string; ms: number; items: activitiesApi.CrmActivity[] }>();

    for (const activity of timelineRows) {
      const ms = parseDateMs(activity.dueAt) ?? parseDateMs(activity.createdAt) ?? 0;
      const header = formatDateLabel(activity.dueAt, activity.createdAt) || '-';
      const key = `${ms}:${header}`;
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(activity);
      } else {
        groups.set(key, { header, ms, items: [activity] });
      }
    }

    const arr = Array.from(groups.values());
    arr.sort((a, b) => b.ms - a.ms);
    return arr;
  }, [timelineRows]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">{t('crm.activities.title')}</div>
          <div className="mt-2 text-sm text-gray-500">
            {scope === 'opportunity'
              ? t('crm.activities.subtitleForDeal', { dealName: dealName || '' })
              : scope === 'contact'
                ? t('crm.activities.subtitleForContact', { contactName: contactName || '' })
                : scope === 'account'
                  ? t('crm.activities.subtitleForAccount', { accountName: accountName || '' })
                  : t('crm.activities.subtitle')}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isScopedTimeline && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ActivityStatusFilter)}
              className="border rounded-lg px-3 py-2 text-sm border-gray-300 text-gray-700"
            >
              <option value="all">{t('crm.activities.filters.all')}</option>
              <option value="open">{t('crm.activities.filters.open')}</option>
              <option value="completed">{t('crm.activities.filters.completed')}</option>
            </select>
          )}
          <button
            type="button"
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
          >
            {t('common.add')}
          </button>
        </div>
      </div>

      {loading && (
        <div className="mt-4 text-sm text-gray-600">{t('common.loading')}</div>
      )}
      {error && (
        <div className="mt-4 text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="mt-6 text-sm text-gray-600">{t('crm.activities.empty')}</div>
      )}

      {!loading && !error && rows.length > 0 && isScopedTimeline && (
        <div className="mt-6 space-y-6">
          {timelineGroups.map((group) => (
            <div key={`${group.ms}:${group.header}`} className="space-y-3">
              <div className="text-xs font-semibold text-gray-500">{group.header}</div>
              <div className="space-y-3">
                {group.items.map((activity) => {
                  const isCompleted = !!activity.completed;
                  return (
                    <div key={activity.id} className="relative pl-5">
                      <div className="absolute left-1 top-3 h-full w-px bg-gray-200" />
                      <div className={isCompleted ? 'absolute left-0 top-3 h-2 w-2 rounded-full bg-gray-300' : 'absolute left-0 top-3 h-2 w-2 rounded-full bg-gray-500'} />
                      <div className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className={isCompleted ? 'text-sm font-medium text-gray-700 line-through' : 'text-sm font-medium text-gray-900'}>
                              {activity.title}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                              {activity.type ? <span>{activity.type}</span> : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={isCompleted ? 'px-2 py-1 rounded-md text-xs bg-gray-200 text-gray-700' : 'px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-800'}>
                              {isCompleted ? t('crm.activities.filters.completed') : t('crm.activities.filters.open')}
                            </span>
                            <button type="button" onClick={() => openEdit(activity)} className="text-blue-600 hover:underline text-sm">
                              {t('common.edit')}
                            </button>
                            <button type="button" onClick={() => startDelete(activity)} className="text-red-600 hover:underline text-sm">
                              {t('common.delete')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && rows.length > 0 && !isScopedTimeline && (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2 pr-4">{t('crm.fields.title')}</th>
                <th className="py-2 pr-4">{t('crm.fields.type')}</th>
                <th className="py-2 pr-4">{t('crm.fields.dueAt')}</th>
                <th className="py-2 pr-4">{t('crm.fields.completed')}</th>
                <th className="py-2">{t('crm.fields.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {timelineRows.map((activity) => (
                <tr key={activity.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 text-gray-900">{activity.title}</td>
                  <td className="py-2 pr-4 text-gray-700">{activity.type || '-'}</td>
                  <td className="py-2 pr-4 text-gray-700">{activity.dueAt || '-'}</td>
                  <td className="py-2 pr-4 text-gray-700">{activity.completed ? t('common.yes') : t('common.no')}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(activity)}
                        className="text-blue-600 hover:underline"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => startDelete(activity)}
                        className="text-red-600 hover:underline"
                      >
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
              {editing ? t('crm.activities.modal.editTitle') : t('crm.activities.modal.createTitle')}
            </h3>

            {modalError && <div className="mb-4 text-sm text-red-600">{modalError}</div>}

            <div className="space-y-4">
              {canPickContactInModal && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.fields.contact')}</label>
                  <select
                    value={form.contactId}
                    onChange={(e) => setForm((p) => ({ ...p, contactId: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 border-gray-300"
                    disabled={contactsLoading}
                  >
                    <option value="">-</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.fields.type')}</label>
                <input
                  type="text"
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.fields.dueAt')}</label>
                <input
                  type="text"
                  value={form.dueAt}
                  onChange={(e) => setForm((p) => ({ ...p, dueAt: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300"
                  placeholder={t('crm.activities.dueAtPlaceholder')}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="crm-activity-completed"
                  type="checkbox"
                  checked={form.completed}
                  onChange={(e) => setForm((p) => ({ ...p, completed: e.target.checked }))}
                  className="h-4 w-4"
                />
                <label htmlFor="crm-activity-completed" className="text-sm text-gray-700">{t('crm.fields.completed')}</label>
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
