import apiClient from './client';

export type CrmContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  accountId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCrmContactDto = {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  accountId?: string | null;
};

export type UpdateCrmContactDto = Partial<CreateCrmContactDto>;

export const listCrmContacts = async (options?: {
  accountId?: string;
}): Promise<CrmContact[]> => {
  const params = new URLSearchParams();
  if (options?.accountId) {
    params.set('accountId', options.accountId);
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const res = await apiClient.get<CrmContact[]>(`/crm/contacts${suffix}`);
  return res.data;
};

export const createCrmContact = async (data: CreateCrmContactDto): Promise<CrmContact> => {
  const res = await apiClient.post<CrmContact>('/crm/contacts', data);
  return res.data;
};

export const updateCrmContact = async (id: string, data: UpdateCrmContactDto): Promise<CrmContact> => {
  const res = await apiClient.patch<CrmContact>(`/crm/contacts/${id}`, data);
  return res.data;
};

export const deleteCrmContact = async (id: string): Promise<void> => {
  await apiClient.delete(`/crm/contacts/${id}`);
};
