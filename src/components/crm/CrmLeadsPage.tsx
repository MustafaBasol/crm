import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../utils/errorHandler';
import * as leadsApi from '../../api/crm-leads';
import { parseLocalObject, safeSessionStorage } from '../../utils/localStorageSafe';

type StoredPageState = {
  query?: string;
  limit?: number;
  offset?: number;
};

const PAGE_STATE_KEY = 'crm.leads.pageState.v1';

const readPageState = (): StoredPageState | null => {
  const raw = safeSessionStorage.getItem(PAGE_STATE_KEY);
  const parsed = parseLocalObject<StoredPageState>(raw, PAGE_STATE_KEY);
  if (!parsed) return null;
  return parsed;
};

type LeadFormState = {
  name: string;
  email: string;
  phone: string;
  company: string;
  status: string;
};

const emptyForm: LeadFormState = {
  name: '',
  email: '',
  phone: '',
  company: '',
  status: '',
};

export default function CrmLeadsPage() {
  const { t } = useTranslation('common');

  const [items, setItems] = useState<leadsApi.CrmLead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const restored = useMemo(() => readPageState(), []);
  const [query, setQuery] = useState(() => (typeof restored?.query === 'string' ? restored.query : ''));
  const [limit] = useState(() => {
    const v = restored?.limit;
    return typeof v === 'number' && Number.isFinite(v) ? v : 25;
  });
  const [offset, setOffset] = useState(() => {
    const v = restored?.offset;
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  });

  useEffect(() => {
    safeSessionStorage.setItem(
      PAGE_STATE_KEY,
      JSON.stringify({ query, limit, offset } satisfies StoredPageState),
    );
  }, [query, limit, offset]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [editing, setEditing] = useState<leadsApi.CrmLead | null>(null);
  const [form, setForm] = useState<LeadFormState>(emptyForm);

  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<leadsApi.CrmLead | null>(null);

  const reload = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await leadsApi.listCrmLeads({
        q: query.trim() ? query.trim() : undefined,
        limit,
        offset,
      });
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
  }, [query, limit, offset]);

  useEffect(() => {
    setOffset(0);
  }, [query, limit]);

  const openCreate = () => {
    setModalError(null);
    setEditing(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (lead: leadsApi.CrmLead) => {
    setModalError(null);
    setEditing(lead);
    setForm({
      name: lead.name ?? '',
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      company: lead.company ?? '',
      status: lead.status ?? '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
  };

  const submit = async () => {
    setModalError(null);
    const name = form.name.trim();
    if (!name) {
      setModalError(t('crm.validation.nameRequired'));
      return;
    }

    try {
      setSaving(true);
      if (editing) {
        await leadsApi.updateCrmLead(editing.id, {
          name,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          company: form.company.trim() || undefined,
          status: form.status.trim() || undefined,
        });
      } else {
        await leadsApi.createCrmLead({
          name,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          company: form.company.trim() || undefined,
          status: form.status.trim() || undefined,
        });
      }
      await reload();
      setIsModalOpen(false);
    } catch (e) {
      setModalError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const startDelete = (lead: leadsApi.CrmLead) => {
    setDeleteTarget(lead);
  };

  const cancelDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await leadsApi.deleteCrmLead(deleteTarget.id);
      await reload();
      setDeleteTarget(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  const rows = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const hasActiveQuery = Boolean(query.trim());
  const hasNoResults = !loading && !error && total > 0 && rows.length === 0;
  const canPrev = offset > 0;
  const canNext = offset + rows.length < total;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">{t('crm.leads.title')}</div>
          <div className="mt-2 text-sm text-gray-500">{t('crm.leads.subtitle')}</div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
        >
          {t('common.add')}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`${t('common.search')}...`}
          className="w-full sm:w-80 border rounded-lg px-3 py-2 border-gray-300 text-sm"
        />
      </div>

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

      {loading && (
        <div className="mt-4 text-sm text-gray-600">{t('common.loading')}</div>
      )}
      {error && (
        <div className="mt-4 text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && total === 0 && (
        <div className="mt-6 text-sm text-gray-600">{t('crm.leads.empty')}</div>
      )}

      {!loading && !error && hasNoResults && (
        <div className="mt-6 text-sm text-gray-600">{t('common.noResults')}</div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2 pr-4">{t('crm.fields.name')}</th>
                <th className="py-2 pr-4">{t('crm.fields.email')}</th>
                <th className="py-2 pr-4">{t('crm.fields.phone')}</th>
                <th className="py-2 pr-4">{t('crm.fields.company')}</th>
                <th className="py-2 pr-4">{t('crm.fields.status')}</th>
                <th className="py-2">{t('crm.fields.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((lead) => (
                <tr key={lead.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 text-gray-900">{lead.name}</td>
                  <td className="py-2 pr-4 text-gray-700">{lead.email || '-'}</td>
                  <td className="py-2 pr-4 text-gray-700">{lead.phone || '-'}</td>
                  <td className="py-2 pr-4 text-gray-700">{lead.company || '-'}</td>
                  <td className="py-2 pr-4 text-gray-700">{lead.status || '-'}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(lead)}
                        className="text-blue-600 hover:underline"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => startDelete(lead)}
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
              {editing ? t('crm.leads.modal.editTitle') : t('crm.leads.modal.createTitle')}
            </h3>

            {modalError && <div className="mb-4 text-sm text-red-600">{modalError}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.fields.name')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.fields.email')}</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.fields.phone')}</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.fields.company')}</label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('crm.fields.status')}</label>
                <input
                  type="text"
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300"
                />
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
            <p className="text-sm text-gray-600 mb-6">{t('crm.confirmDelete.message', { name: deleteTarget.name })}</p>

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
