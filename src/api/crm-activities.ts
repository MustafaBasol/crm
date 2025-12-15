import apiClient from './client';

export type CrmActivity = {
  id: string;
  title: string;
  type: string;
  dueAt: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateCrmActivityDto = {
  title: string;
  type?: string;
  dueAt?: string | null;
  completed?: boolean;
};

export type UpdateCrmActivityDto = Partial<CreateCrmActivityDto>;

export const listCrmActivities = async (): Promise<CrmActivity[]> => {
  const res = await apiClient.get<CrmActivity[]>('/crm/activities');
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
