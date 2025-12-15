import apiClient from './client';

export type CrmContact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateCrmContactDto = {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
};

export type UpdateCrmContactDto = Partial<CreateCrmContactDto>;

export const listCrmContacts = async (): Promise<CrmContact[]> => {
  const res = await apiClient.get<CrmContact[]>('/crm/contacts');
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
