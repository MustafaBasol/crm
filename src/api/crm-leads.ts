import apiClient from './client';

export type CrmLead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateCrmLeadDto = {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status?: string;
};

export type UpdateCrmLeadDto = Partial<CreateCrmLeadDto>;

export const listCrmLeads = async (): Promise<CrmLead[]> => {
  const res = await apiClient.get<CrmLead[]>('/crm/leads');
  return res.data;
};

export const createCrmLead = async (data: CreateCrmLeadDto): Promise<CrmLead> => {
  const res = await apiClient.post<CrmLead>('/crm/leads', data);
  return res.data;
};

export const updateCrmLead = async (id: string, data: UpdateCrmLeadDto): Promise<CrmLead> => {
  const res = await apiClient.patch<CrmLead>(`/crm/leads/${id}`, data);
  return res.data;
};

export const deleteCrmLead = async (id: string): Promise<void> => {
  await apiClient.delete(`/crm/leads/${id}`);
};
