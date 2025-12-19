import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../utils/errorHandler';
import * as leadsApi from '../../api/crm-leads';
import { parseLocalObject, safeSessionStorage } from '../../utils/localStorageSafe';
import Pagination from '../Pagination';
import SavedViewsBar from '../SavedViewsBar';

type StoredPageState = {
  query?: string;
  startDate?: string;
  endDate?: string;
  sortKey?: string;
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

type LeadSortKey =
  | 'updatedDesc'
  | 'updatedAsc'
  | 'createdDesc'
  | 'createdAsc'
  | 'nameAsc'
  | 'nameDesc';

export default function CrmLeadsPage() {
  const { t } = useTranslation('common');

  const [items, setItems] = useState<leadsApi.CrmLead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const restored = useMemo(() => readPageState(), []);
  const [query, setQuery] = useState(() => (typeof restored?.query === 'string' ? restored.query : ''));
  const [startDate, setStartDate] = useState(() =>
    typeof restored?.startDate === 'string' ? restored.startDate : '',
  );
  const [endDate, setEndDate] = useState(() => (typeof restored?.endDate === 'string' ? restored.endDate : ''));

  const [sortKey, setSortKey] = useState<LeadSortKey>(() => {
    const v = restored?.sortKey;
    const allowed: LeadSortKey[] = ['updatedDesc', 'updatedAsc', 'createdDesc', 'createdAsc', 'nameAsc', 'nameDesc'];
    return typeof v === 'string' && (allowed as string[]).includes(v)
      ? (v as LeadSortKey)
      : 'updatedDesc';
  });

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
    safeSessionStorage.setItem(
      PAGE_STATE_KEY,
      JSON.stringify({ query, startDate, endDate, sortKey, limit, offset } satisfies StoredPageState),
    );
  }, [query, startDate, endDate, sortKey, limit, offset]);

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
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        ...(sortKey === 'updatedAsc'
          ? { sortBy: 'updatedAt' as const, sortDir: 'asc' as const }
          : sortKey === 'createdDesc'
            ? { sortBy: 'createdAt' as const, sortDir: 'desc' as const }
            : sortKey === 'createdAsc'
              ? { sortBy: 'createdAt' as const, sortDir: 'asc' as const }
              : sortKey === 'nameAsc'
                ? { sortBy: 'name' as const, sortDir: 'asc' as const }
                : sortKey === 'nameDesc'
                  ? { sortBy: 'name' as const, sortDir: 'desc' as const }
                  : { sortBy: 'updatedAt' as const, sortDir: 'desc' as const }),
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
  }, [query, startDate, endDate, sortKey, limit, offset]);

  useEffect(() => {
    setOffset(0);
  }, [query, startDate, endDate, sortKey, limit]);

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
  const pageNumber = Math.floor(offset / limit) + 1;

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
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as LeadSortKey)}
          className="w-full lg:w-64 border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-500"
          aria-label={t('app.sort.label') as string}
        >
          <option value="updatedDesc">{t('app.sort.updatedDesc')}</option>
          <option value="updatedAsc">{t('app.sort.updatedAsc')}</option>
          <option value="createdDesc">{t('app.sort.createdDesc')}</option>
          <option value="createdAsc">{t('app.sort.createdAsc')}</option>
          <option value="nameAsc">{t('app.sort.nameAsc')}</option>
          <option value="nameDesc">{t('app.sort.nameDesc')}</option>
        </select>

        <div className="lg:ml-auto flex items-center">
          <SavedViewsBar
            listType="crm_leads"
            getState={() => ({ query, startDate, endDate, sortKey, pageSize: limit })}
            applyState={(state) => {
              if (!state) return;
              setQuery(state.query ?? '');
              setStartDate(state.startDate ?? '');
              setEndDate(state.endDate ?? '');
              if (typeof state.sortKey === 'string') {
                const allowed: LeadSortKey[] = ['updatedDesc', 'updatedAsc', 'createdDesc', 'createdAsc', 'nameAsc', 'nameDesc'];
                if ((allowed as string[]).includes(state.sortKey)) setSortKey(state.sortKey as LeadSortKey);
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
              {
                id: 'last-month',
                label: t('presets.lastMonth') as string,
                apply: () => {
                  const d = new Date();
                  const start = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10);
                  const end = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10);
                  setStartDate(start);
                  setEndDate(end);
                  setOffset(0);
                },
              },
              {
                id: 'this-year',
                label: t('presets.thisYear') as string,
                apply: () => {
                  const d = new Date();
                  const start = new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
                  const end = new Date(d.getFullYear(), 11, 31).toISOString().slice(0, 10);
                  setStartDate(start);
                  setEndDate(end);
                  setOffset(0);
                },
              },
            ]}
          />
        </div>
      </div>

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
