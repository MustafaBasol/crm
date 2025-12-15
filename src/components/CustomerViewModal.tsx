import React from 'react';
import { X, Edit, Mail, Phone, MapPin, Building2, User, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { safeLocalStorage } from '../utils/localStorageSafe';
import type { Customer as CustomerModel } from '../api/customers';
import { getErrorMessage } from '../utils/errorHandler';
import * as crmActivitiesApi from '../api/crm-activities';

type CustomerWithMeta = CustomerModel & {
  createdByName?: string;
  updatedByName?: string;
};

interface CustomerViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerWithMeta | null;
  onEdit: (customer: CustomerWithMeta) => void;
  onCreateInvoice?: (customer: CustomerWithMeta) => void;
  onRecordPayment?: (customer: CustomerWithMeta) => void;
  onViewHistory?: (customer: CustomerWithMeta) => void;
}

export default function CustomerViewModal({ 
  isOpen, 
  onClose, 
  customer, 
  onEdit,
  onCreateInvoice,
  onRecordPayment: _onRecordPayment,
  onViewHistory
}: CustomerViewModalProps) {
  const { t, i18n } = useTranslation();
  const [crmActivities, setCrmActivities] = React.useState<crmActivitiesApi.CrmActivity[]>([]);
  const [crmLoading, setCrmLoading] = React.useState(false);
  const [crmError, setCrmError] = React.useState<string | null>(null);
  const [crmStatusFilter, setCrmStatusFilter] = React.useState<'all' | 'open' | 'completed'>('all');

  const [isCrmCreateOpen, setIsCrmCreateOpen] = React.useState(false);
  const [crmEditing, setCrmEditing] = React.useState<crmActivitiesApi.CrmActivity | null>(null);
  const [crmSaving, setCrmSaving] = React.useState(false);
  const [crmModalError, setCrmModalError] = React.useState<string | null>(null);
  const [crmForm, setCrmForm] = React.useState<{ title: string; type: string; dueAt: string; completed: boolean }>({
    title: '',
    type: '',
    dueAt: '',
    completed: false,
  });

  const [crmDeleting, setCrmDeleting] = React.useState(false);
  const [crmDeleteTarget, setCrmDeleteTarget] = React.useState<crmActivitiesApi.CrmActivity | null>(null);

  // Güvenli çeviri yardımcısı: önce common:, sonra düz anahtar; yoksa varsayılan
  const te = (key: string, def: string) => {
    const v1 = t(`common:${key}`, { defaultValue: '' });
    if (typeof v1 === 'string' && v1 !== `common:${key}` && v1.trim() !== '') return v1;
    const v2 = t(key, { defaultValue: def });
    if (typeof v2 === 'string' && v2 !== key && v2.trim() !== '') return v2;
    return def;
  };

  // Aktif dili ve tarih yerelini belirle
  const getActiveLang = () => {
    const stored = safeLocalStorage.getItem('i18nextLng');
    if (stored && stored.length >= 2) {
      return stored.slice(0, 2).toLowerCase();
    }
    const cand = (i18n.resolvedLanguage || i18n.language || 'en');
    return cand.slice(0,2).toLowerCase();
  };
  const toLocale = (l: string) => (l === 'tr' ? 'tr-TR' : l === 'de' ? 'de-DE' : l === 'fr' ? 'fr-FR' : 'en-US');
  const lang = getActiveLang();
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString(toLocale(lang));

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

  const formatCrmDateLabel = (value: string | null | undefined, fallbackIso: string | null | undefined): string => {
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

  const reloadCrmActivities = React.useCallback(async () => {
    if (!customer?.id) return;
    setCrmError(null);
    setCrmLoading(true);
    try {
      const data = await crmActivitiesApi.listCrmActivities({ accountId: String(customer.id) });
      setCrmActivities(Array.isArray(data) ? data : []);
    } catch (e) {
      setCrmError(getErrorMessage(e));
    } finally {
      setCrmLoading(false);
    }
  }, [customer?.id]);

  const crmTimelineRows = React.useMemo(() => {
    const base = Array.isArray(crmActivities) ? [...crmActivities] : [];
    const filtered = base.filter((a) => {
      if (crmStatusFilter === 'completed') return !!a.completed;
      if (crmStatusFilter === 'open') return !a.completed;
      return true;
    });

    const sortKey = (a: crmActivitiesApi.CrmActivity): number => {
      return parseDateMs(a.dueAt) ?? parseDateMs(a.createdAt) ?? 0;
    };

    filtered.sort((a, b) => sortKey(b) - sortKey(a));
    return filtered;
  }, [crmActivities, crmStatusFilter]);

  React.useEffect(() => {
    if (!isOpen) return;
    void reloadCrmActivities();
  }, [isOpen, reloadCrmActivities]);

  React.useEffect(() => {
    if (!isOpen) return;
    setCrmStatusFilter('all');
    setIsCrmCreateOpen(false);
    setCrmEditing(null);
    setCrmModalError(null);
    setCrmForm({ title: '', type: '', dueAt: '', completed: false });
    setCrmDeleting(false);
    setCrmDeleteTarget(null);
  }, [isOpen, customer?.id]);

  const openCrmCreate = () => {
    setCrmModalError(null);
    setCrmEditing(null);
    setCrmForm({ title: '', type: '', dueAt: '', completed: false });
    setIsCrmCreateOpen(true);
  };

  const openCrmEdit = (activity: crmActivitiesApi.CrmActivity) => {
    setCrmModalError(null);
    setCrmEditing(activity);
    setCrmForm({
      title: activity.title ?? '',
      type: activity.type ?? '',
      dueAt: activity.dueAt ?? '',
      completed: !!activity.completed,
    });
    setIsCrmCreateOpen(true);
  };

  const closeCrmCreate = () => {
    if (crmSaving) return;
    setIsCrmCreateOpen(false);
  };

  const submitCrmCreate = async () => {
    if (!customer?.id) return;
    setCrmModalError(null);

    const title = crmForm.title.trim();
    if (!title) {
      setCrmModalError(te('crm.validation.titleRequired', 'Title is required'));
      return;
    }

    const payload: crmActivitiesApi.CreateCrmActivityDto = {
      title,
      type: crmForm.type.trim() || undefined,
      dueAt: crmForm.dueAt.trim() ? crmForm.dueAt.trim() : null,
      completed: !!crmForm.completed,
      accountId: String(customer.id),
      opportunityId: null,
    };

    try {
      setCrmSaving(true);
      if (crmEditing) {
        await crmActivitiesApi.updateCrmActivity(crmEditing.id, payload);
      } else {
        await crmActivitiesApi.createCrmActivity(payload);
      }
      await reloadCrmActivities();
      setIsCrmCreateOpen(false);
    } catch (e) {
      setCrmModalError(getErrorMessage(e));
    } finally {
      setCrmSaving(false);
    }
  };

  const startCrmDelete = (activity: crmActivitiesApi.CrmActivity) => {
    setCrmDeleteTarget(activity);
  };

  const cancelCrmDelete = () => {
    if (crmDeleting) return;
    setCrmDeleteTarget(null);
  };

  const confirmCrmDelete = async () => {
    if (!crmDeleteTarget) return;
    try {
      setCrmDeleting(true);
      await crmActivitiesApi.deleteCrmActivity(crmDeleteTarget.id);
      await reloadCrmActivities();
      setCrmDeleteTarget(null);
    } catch (e) {
      setCrmError(getErrorMessage(e));
    } finally {
      setCrmDeleting(false);
    }
  };

  if (!isOpen || !customer) {
    return null;
  }

  const L = {
    createdBy: { tr: 'Oluşturan', en: 'Created by', de: 'Erstellt von', fr: 'Créé par' }[lang as 'tr'|'en'|'de'|'fr'] || 'Created by',
    createdAt: { tr: 'Oluşturulma', en: 'Created at', de: 'Erstellt am', fr: 'Créé le' }[lang as 'tr'|'en'|'de'|'fr'] || 'Created at',
    updatedBy: { tr: 'Son güncelleyen', en: 'Last updated by', de: 'Zuletzt aktualisiert von', fr: 'Dernière mise à jour par' }[lang as 'tr'|'en'|'de'|'fr'] || 'Last updated by',
    updatedAt: { tr: 'Son güncelleme', en: 'Last updated', de: 'Zuletzt aktualisiert', fr: 'Dernière mise à jour' }[lang as 'tr'|'en'|'de'|'fr'] || 'Last updated',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center">
              <span className="text-purple-600 font-bold text-2xl">
                {customer.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{customer.name}</h2>
              <p className="text-sm text-gray-500">{te('customer.details', 'Customer Details')}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onEdit(customer)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Edit className="w-5 h-5 text-gray-500" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6" id={`customer-${customer.id}`}>
          {/* Oluşturan / Güncelleyen */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 text-xs text-gray-600">
            <div>
              <div>
                <span className="text-gray-500">{L.createdBy}:</span>{' '}
                <span className="font-medium">{customer.createdByName || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">{L.createdAt}:</span>{' '}
                <span className="font-medium">{customer.createdAt ? new Date(customer.createdAt).toLocaleString(toLocale(lang)) : '—'}</span>
              </div>
            </div>
            <div>
              <div>
                <span className="text-gray-500">{L.updatedBy}:</span>{' '}
                <span className="font-medium">{customer.updatedByName || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">{L.updatedAt}:</span>{' '}
                <span className="font-medium">{customer.updatedAt ? new Date(customer.updatedAt).toLocaleString(toLocale(lang)) : '—'}</span>
              </div>
            </div>
          </div>
          {/* Customer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{te('customer.personalInfo', 'Personal Information')}</h3>
              <div className="space-y-4">
                <div className="flex items-center text-sm">
                  <User className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">{te('customer.name', 'Name')}:</span>
                    <span className="ml-2 font-medium text-gray-900">{customer.name}</span>
                  </div>
                </div>
                <div className="flex items-center text-sm">
                  <Mail className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">{te('customer.email', 'Email')}:</span>
                    <span className="ml-2 font-medium text-gray-900">{customer.email}</span>
                  </div>
                </div>
                {customer.phone && (
                  <div className="flex items-center text-sm">
                    <Phone className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <span className="text-gray-600">{te('customer.phone', 'Phone')}:</span>
                      <span className="ml-2 font-medium text-gray-900">{customer.phone}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">{te('customer.registeredAt', 'Registered Date')}:</span>
                    <span className="ml-2 font-medium text-gray-900">{formatDate(customer.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{te('customer.companyInfo', 'Company Information')}</h3>
              <div className="space-y-4">
                {customer.company && (
                  <div className="flex items-center text-sm">
                    <Building2 className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <span className="text-gray-600">{te('customer.company', 'Company')}:</span>
                      <span className="ml-2 font-medium text-gray-900">{customer.company}</span>
                    </div>
                  </div>
                )}
                {customer.taxNumber && (
                  <div className="flex items-center text-sm">
                    <span className="w-4 h-4 text-gray-400 mr-3 text-xs font-bold flex items-center justify-center">VN</span>
                    <div>
                      <span className="text-gray-600">{te('customer.taxNumber', 'Tax Number')}:</span>
                      <span className="ml-2 font-medium text-gray-900">{customer.taxNumber}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Address */}
          {customer.address && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{te('customer.addressInfo', 'Address Information')}</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-start">
                  <MapPin className="w-4 h-4 text-gray-400 mr-3 mt-0.5" />
                  <p className="text-gray-700">{customer.address}</p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{te('customer.quickActions', 'Quick Actions')}</h3>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => onCreateInvoice?.(customer)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <span>{te('customer.createInvoice', 'Create Invoice')}</span>
              </button>
              <button 
                onClick={() => onViewHistory?.(customer)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                <span>{te('customer.viewHistory', 'View History')}</span>
              </button>
            </div>
          </div>

          {/* CRM Activities (Account/Customer scope) */}
          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{te('crm.activities.title', 'Activities')}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {te('crm.activities.subtitleForAccount', 'Activities for "{{accountName}}"').replace('{{accountName}}', customer.name)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={crmStatusFilter}
                  onChange={(e) => setCrmStatusFilter(e.target.value as 'all' | 'open' | 'completed')}
                  className="border rounded-lg px-3 py-2 text-sm border-gray-300 text-gray-700"
                >
                  <option value="all">{te('crm.activities.filters.all', 'All')}</option>
                  <option value="open">{te('crm.activities.filters.open', 'Open')}</option>
                  <option value="completed">{te('crm.activities.filters.completed', 'Completed')}</option>
                </select>
                <button
                  type="button"
                  onClick={openCrmCreate}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
                >
                  {te('common.add', 'Add')}
                </button>
              </div>
            </div>

            {crmLoading && <div className="mt-3 text-sm text-gray-600">{te('common.loading', 'Loading...')}</div>}
            {crmError && <div className="mt-3 text-sm text-red-600">{crmError}</div>}

            {!crmLoading && !crmError && crmTimelineRows.length === 0 && (
              <div className="mt-3 text-sm text-gray-600">{te('crm.activities.empty', 'No activities yet.')}</div>
            )}

            {!crmLoading && !crmError && crmTimelineRows.length > 0 && (
              <div className="mt-4 space-y-3">
                {crmTimelineRows.map((activity) => {
                  const isCompleted = !!activity.completed;
                  const dateLabel = formatCrmDateLabel(activity.dueAt, activity.createdAt);
                  return (
                    <div key={activity.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className={isCompleted ? 'text-sm font-medium text-gray-700 line-through' : 'text-sm font-medium text-gray-900'}>
                            {activity.title}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                            {activity.type ? <span>{activity.type}</span> : null}
                            {dateLabel ? <span>{dateLabel}</span> : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={isCompleted ? 'px-2 py-1 rounded-md text-xs bg-gray-200 text-gray-700' : 'px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-800'}>
                            {isCompleted ? te('crm.activities.filters.completed', 'Completed') : te('crm.activities.filters.open', 'Open')}
                          </span>
                          <button type="button" onClick={() => openCrmEdit(activity)} className="text-blue-600 hover:underline text-sm">
                            {te('common.edit', 'Edit')}
                          </button>
                          <button type="button" onClick={() => startCrmDelete(activity)} className="text-red-600 hover:underline text-sm">
                            {te('common.delete', 'Delete')}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {isCrmCreateOpen && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {crmEditing ? te('crm.activities.modal.editTitle', 'Edit Activity') : te('crm.activities.modal.createTitle', 'Add Activity')}
                </h3>

                {crmModalError && <div className="mb-4 text-sm text-red-600">{crmModalError}</div>}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{te('crm.fields.title', 'Title')}</label>
                    <input
                      type="text"
                      value={crmForm.title}
                      onChange={(e) => setCrmForm((p) => ({ ...p, title: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 border-gray-300"
                      disabled={crmSaving}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{te('crm.fields.type', 'Type')}</label>
                    <input
                      type="text"
                      value={crmForm.type}
                      onChange={(e) => setCrmForm((p) => ({ ...p, type: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 border-gray-300"
                      disabled={crmSaving}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{te('crm.fields.dueAt', 'Date / Due')}</label>
                    <input
                      type="text"
                      value={crmForm.dueAt}
                      onChange={(e) => setCrmForm((p) => ({ ...p, dueAt: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 border-gray-300"
                      placeholder={te('crm.activities.dueAtPlaceholder', 'e.g. 2025-12-15')}
                      disabled={crmSaving}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="customer-crm-activity-completed"
                      type="checkbox"
                      checked={crmForm.completed}
                      onChange={(e) => setCrmForm((p) => ({ ...p, completed: e.target.checked }))}
                      className="h-4 w-4"
                      disabled={crmSaving}
                    />
                    <label htmlFor="customer-crm-activity-completed" className="text-sm text-gray-700">
                      {te('crm.fields.completed', 'Completed')}
                    </label>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeCrmCreate}
                    className="px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50"
                    disabled={crmSaving}
                  >
                    {te('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={submitCrmCreate}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
                    disabled={crmSaving}
                  >
                    {te('common.save', 'Save')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {crmDeleteTarget && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-2">{te('crm.confirmDelete.title', 'Confirm delete')}</h3>
                <p className="text-sm text-gray-600 mb-6">
                  {te('crm.confirmDelete.message', 'Delete "{{name}}"?').replace('{{name}}', crmDeleteTarget.title)}
                </p>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelCrmDelete}
                    className="px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50"
                    disabled={crmDeleting}
                  >
                    {te('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={confirmCrmDelete}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm"
                    disabled={crmDeleting}
                  >
                    {te('common.confirm', 'Confirm')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}