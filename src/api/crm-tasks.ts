import apiClient from './client';

export type CrmTask = {
  id: string;
  title: string;
  opportunityId: string | null;
  accountId: string | null;
  dueAt: string | null;
  completed: boolean;
  assigneeUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCrmTaskDto = {
  title: string;
  opportunityId?: string | null;
  accountId?: string | null;
  dueAt?: string | null;
  completed?: boolean;
  assigneeUserId?: string | null;
};

export type UpdateCrmTaskDto = Partial<Omit<CreateCrmTaskDto, 'opportunityId'>> & {
  opportunityId?: string;
};

export const listCrmTasks = async (options?: {
  opportunityId?: string;
  accountId?: string;
  status?: 'open' | 'completed';
  limit?: number;
  offset?: number;
}): Promise<import('./crm-leads').CrmPagedResponse<CrmTask>> => {
  const res = await apiClient.get<import('./crm-leads').CrmPagedResponse<CrmTask>>('/crm/tasks', {
    params: {
      opportunityId: options?.opportunityId,
      accountId: options?.accountId,
      status: options?.status,
      limit: options?.limit,
      offset: options?.offset,
    },
  });
  return res.data;
};

export const createCrmTask = async (data: CreateCrmTaskDto): Promise<CrmTask> => {
  const res = await apiClient.post<CrmTask>('/crm/tasks', data);
  return res.data;
};

export const updateCrmTask = async (id: string, data: UpdateCrmTaskDto): Promise<CrmTask> => {
  const res = await apiClient.patch<CrmTask>(`/crm/tasks/${id}`, data);
  return res.data;
};

export const deleteCrmTask = async (id: string): Promise<void> => {
  await apiClient.delete(`/crm/tasks/${id}`);
};
