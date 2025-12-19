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
  q?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'updatedAt' | 'createdAt' | 'name';
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}): Promise<import('./crm-leads').CrmPagedResponse<CrmContact>> => {
  const res = await apiClient.get<import('./crm-leads').CrmPagedResponse<CrmContact>>(
    '/crm/contacts',
    {
      params: {
        accountId: options?.accountId,
        q: options?.q,
        startDate: options?.startDate,
        endDate: options?.endDate,
        sortBy: options?.sortBy,
        sortDir: options?.sortDir,
        limit: options?.limit,
        offset: options?.offset,
      },
    },
  );
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
