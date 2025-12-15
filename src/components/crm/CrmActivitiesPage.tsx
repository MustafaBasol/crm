import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../utils/errorHandler';
import * as activitiesApi from '../../api/crm-activities';

type ActivityFormState = {
  title: string;
  type: string;
  dueAt: string;
  completed: boolean;
};

const emptyForm: ActivityFormState = {
  title: '',
  type: '',
  dueAt: '',
  completed: false,
};

export default function CrmActivitiesPage() {
  const { t } = useTranslation('common');

  const [items, setItems] = useState<activitiesApi.CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [editing, setEditing] = useState<activitiesApi.CrmActivity | null>(null);
  const [form, setForm] = useState<ActivityFormState>(emptyForm);

  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<activitiesApi.CrmActivity | null>(null);

  const reload = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await activitiesApi.listCrmActivities();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

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

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">{t('crm.activities.title')}</div>
          <div className="mt-2 text-sm text-gray-500">{t('crm.activities.subtitle')}</div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
        >
          {t('common.add')}
        </button>
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

      {!loading && !error && rows.length > 0 && (
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
              {rows.map((activity) => (
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
