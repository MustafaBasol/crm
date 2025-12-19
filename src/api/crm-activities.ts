import apiClient from './client';

export type CrmActivity = {
  id: string;
  title: string;
  type: string;
  accountId: string | null;
  opportunityId: string | null;
  contactId: string | null;
  dueAt: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateCrmActivityDto = {
  title: string;
  type?: string;
  accountId?: string | null;
  opportunityId?: string | null;
  contactId?: string | null;
  dueAt?: string | null;
  completed?: boolean;
};

export type UpdateCrmActivityDto = Partial<CreateCrmActivityDto>;

export const listCrmActivities = async (options?: {
  opportunityId?: string;
  accountId?: string;
  contactId?: string;
  q?: string;
  sortBy?: 'updatedAt' | 'createdAt' | 'title';
  sortDir?: 'asc' | 'desc';
  status?: 'open' | 'completed';
  limit?: number;
  offset?: number;
}): Promise<import('./crm-leads').CrmPagedResponse<CrmActivity>> => {
  const res = await apiClient.get<import('./crm-leads').CrmPagedResponse<CrmActivity>>('/crm/activities', {
    params: {
      ...(options?.opportunityId ? { opportunityId: options.opportunityId } : {}),
      ...(options?.accountId ? { accountId: options.accountId } : {}),
      ...(options?.contactId ? { contactId: options.contactId } : {}),
      ...(options?.q ? { q: options.q } : {}),
      ...(options?.sortBy ? { sortBy: options.sortBy } : {}),
      ...(options?.sortDir ? { sortDir: options.sortDir } : {}),
      ...(options?.status ? { status: options.status } : {}),
      ...(typeof options?.limit === 'number' ? { limit: options.limit } : {}),
      ...(typeof options?.offset === 'number' ? { offset: options.offset } : {}),
    },
  });
  return res.data;
};

export const createCrmActivity = async (data: CreateCrmActivityDto): Promise<CrmActivity> => {
  const res = await apiClient.post<CrmActivity>('/crm/activities', data);
  return res.data;
};

export const updateCrmActivity = async (id: string, data: UpdateCrmActivityDto): Promise<CrmActivity> => {
  const res = await apiClient.patch<CrmActivity>(`/crm/activities/${id}`, data);
  return res.data;
};

export const deleteCrmActivity = async (id: string): Promise<void> => {
  await apiClient.delete(`/crm/activities/${id}`);
};
