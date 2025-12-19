import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../utils/errorHandler';
import * as contactsApi from '../../api/crm-contacts';
import * as customersApi from '../../api/customers';
import { parseLocalObject, safeSessionStorage } from '../../utils/localStorageSafe';

type Props = {
  initialAccountId?: string;
};

type StoredPageState = {
  query?: string;
  accountFilterId?: string;
  sortKey?: string;
  limit?: number;
  offset?: number;
};

const PAGE_STATE_KEY = 'crm.contacts.pageState.v1';

const readPageState = (): StoredPageState | null => {
  const raw = safeSessionStorage.getItem(PAGE_STATE_KEY);
  const parsed = parseLocalObject<StoredPageState>(raw, PAGE_STATE_KEY);
  if (!parsed) return null;
  return parsed;
};

type ContactSortKey = 'updatedDesc' | 'updatedAsc' | 'createdDesc' | 'createdAsc' | 'nameAsc' | 'nameDesc';

type ContactFormState = {
  name: string;
  email: string;
  phone: string;
  company: string;
  accountId: string;
};

const emptyForm: ContactFormState = {
  name: '',
  email: '',
  phone: '',
  company: '',
  accountId: '',
};

export default function CrmContactsPage({ initialAccountId }: Props) {
  const { t } = useTranslation('common');

  const restored = useMemo(() => readPageState(), []);

  const [items, setItems] = useState<contactsApi.CrmContact[]>([]);
  const [total, setTotal] = useState(0);
  const [customers, setCustomers] = useState<customersApi.Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [editing, setEditing] = useState<contactsApi.CrmContact | null>(null);
  const [form, setForm] = useState<ContactFormState>(emptyForm);

  const [query, setQuery] = useState(() => (typeof restored?.query === 'string' ? restored.query : ''));
  const [accountFilterId, setAccountFilterId] = useState(() => {
    if (initialAccountId) return initialAccountId;
    return typeof restored?.accountFilterId === 'string' ? restored.accountFilterId : '';
  });
  const [limit] = useState(() => {
    const v = restored?.limit;
    return typeof v === 'number' && Number.isFinite(v) ? v : 25;
  });
  const [offset, setOffset] = useState(() => {
    const v = restored?.offset;
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  });

  const [sortKey, setSortKey] = useState<ContactSortKey>(() => {
    const v = restored?.sortKey;
    const allowed: ContactSortKey[] = ['updatedDesc', 'updatedAsc', 'createdDesc', 'createdAsc', 'nameAsc', 'nameDesc'];
    return typeof v === 'string' && (allowed as string[]).includes(v) ? (v as ContactSortKey) : 'updatedDesc';
  });

  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<contactsApi.CrmContact | null>(null);

  const reload = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await contactsApi.listCrmContacts({
        accountId: accountFilterId.trim() ? accountFilterId.trim() : undefined,
        q: query.trim() ? query.trim() : undefined,
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

  const loadCustomers = async () => {
    try {
      const data = await customersApi.getCustomers();
      setCustomers(Array.isArray(data) ? data : []);
    } catch {
      // Customers load is best-effort; contacts page should still work.
      setCustomers([]);
    }
  };

  useEffect(() => {
    if (!initialAccountId) return;
    setAccountFilterId((prev) => (prev === initialAccountId ? prev : initialAccountId));
  }, [initialAccountId]);

  useEffect(() => {
    safeSessionStorage.setItem(
      PAGE_STATE_KEY,
      JSON.stringify({
        query,
        accountFilterId,
        sortKey,
        limit,
        offset,
      } satisfies StoredPageState),
    );
  }, [query, accountFilterId, sortKey, limit, offset]);

  useEffect(() => {
    void reload();
    void loadCustomers();
  }, [accountFilterId, query, sortKey, limit, offset]);

  useEffect(() => {
    setOffset(0);
  }, [accountFilterId, query, sortKey, limit]);

  const openCreate = () => {
    setModalError(null);
    setEditing(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (contact: contactsApi.CrmContact) => {
    setModalError(null);
    setEditing(contact);
    setForm({
      name: contact.name ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      company: contact.company ?? '',
      accountId: contact.accountId ?? '',
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
        await contactsApi.updateCrmContact(editing.id, {
          name,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          company: form.company.trim() || undefined,
          accountId: form.accountId.trim() ? form.accountId.trim() : null,
        });
      } else {
        await contactsApi.createCrmContact({
          name,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          company: form.company.trim() || undefined,
          accountId: form.accountId.trim() ? form.accountId.trim() : undefined,
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

  const startDelete = (contact: contactsApi.CrmContact) => {
    setDeleteTarget(contact);
  };

  const cancelDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await contactsApi.deleteCrmContact(deleteTarget.id);
      await reload();
      setDeleteTarget(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  const rows = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const hasNoResults = !loading && !error && total > 0 && rows.length === 0;
  const canPrev = offset > 0;
  const canNext = offset + rows.length < total;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">{t('crm.contacts.title')}</div>
          <div className="mt-2 text-sm text-gray-500">{t('crm.contacts.subtitle')}</div>
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

        <select
          value={accountFilterId}
          onChange={(e) => setAccountFilterId(e.target.value)}
          className="w-full sm:w-64 border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white"
        >
          <option value="">{t('crm.opportunities.filters.allAccounts')}</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as ContactSortKey)}
          className="w-full sm:w-64 border rounded-lg px-3 py-2 border-gray-300 text-sm bg-white"
          aria-label={t('crm.sort.label') as string}
        >
          <option value="updatedDesc">{t('crm.sort.updatedDesc')}</option>
          <option value="updatedAsc">{t('crm.sort.updatedAsc')}</option>
          <option value="createdDesc">{t('crm.sort.createdDesc')}</option>
          <option value="createdAsc">{t('crm.sort.createdAsc')}</option>
          <option value="nameAsc">{t('crm.sort.nameAsc')}</option>
          <option value="nameDesc">{t('crm.sort.nameDesc')}</option>
        </select>
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
        <div className="mt-6 text-sm text-gray-600">{t('crm.contacts.empty')}</div>
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
                <th className="py-2 pr-4">{t('crm.fields.account')}</th>
                <th className="py-2 pr-4">{t('crm.fields.company')}</th>
                <th className="py-2">{t('crm.fields.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((contact) => (
                <tr key={contact.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 text-gray-900">{contact.name}</td>
                  <td className="py-2 pr-4 text-gray-700">{contact.email || '-'}</td>
                  <td className="py-2 pr-4 text-gray-700">{contact.phone || '-'}</td>
                  <td className="py-2 pr-4 text-gray-700">
                    {contact.accountId ? (
                      <button
                        type="button"
                        onClick={() => {
                          window.location.hash = `customer-history:${contact.accountId}`;
                        }}
                        className="text-blue-600 hover:underline text-left"
                      >
                        {customerNameById.get(contact.accountId) || contact.accountId}
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-2 pr-4 text-gray-700">{contact.company || '-'}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(contact)}
                        className="text-blue-600 hover:underline"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          window.location.hash = `crm-activities-contact:${contact.id}`;
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        {t('sidebar.crmActivities')}
                      </button>
                      {contact.accountId ? (
                        <button
                          type="button"
                          onClick={() => {
                            window.location.hash = `crm-tasks:${contact.accountId}`;
                          }}
                          className="text-blue-600 hover:underline"
                        >
                          {t('sidebar.crmTasks')}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => startDelete(contact)}
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
              {editing ? t('crm.contacts.modal.editTitle') : t('crm.contacts.modal.createTitle')}
            </h3>

            {modalError && <div className="mb-4 text-sm text-red-600">{modalError}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('crm.fields.account')}
                </label>
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
