import apiClient from './client';

export type BackendNotification = {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'warning' | 'success' | 'danger' | null;
  link: string | null;
  relatedId: string | null;
  i18nTitleKey: string | null;
  i18nDescKey: string | null;
  i18nParams: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsListResponse = {
  items: BackendNotification[];
  total: number;
  limit: number;
  offset: number;
};

export const listNotifications = async (params?: {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<NotificationsListResponse> => {
  const response = await apiClient.get<NotificationsListResponse>('/notifications', {
    params: {
      unreadOnly: params?.unreadOnly ? 1 : undefined,
      limit: params?.limit,
      offset: params?.offset,
    },
  });
  return response.data;
};

export const getUnreadCount = async (): Promise<{ unread: number }> => {
  const response = await apiClient.get<{ unread: number }>('/notifications/unread-count');
  return response.data;
};

export const markAllRead = async (): Promise<{ success: boolean; updated?: number }> => {
  const response = await apiClient.post<{ success: boolean; updated?: number }>('/notifications/read-all');
  return response.data;
};

export const markRead = async (id: string): Promise<{ success: boolean }> => {
  const response = await apiClient.post<{ success: boolean }>(`/notifications/${encodeURIComponent(id)}/read`);
  return response.data;
};
