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

export type CrmPagedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export const listCrmLeads = async (options?: {
  q?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'updatedAt' | 'createdAt' | 'name';
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}): Promise<CrmPagedResponse<CrmLead>> => {
  const res = await apiClient.get<CrmPagedResponse<CrmLead>>('/crm/leads', {
    params: {
      q: options?.q,
      startDate: options?.startDate,
      endDate: options?.endDate,
      sortBy: options?.sortBy,
      sortDir: options?.sortDir,
      limit: options?.limit,
      offset: options?.offset,
    },
  });
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
