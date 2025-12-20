import apiClient from './client';

export type PipelineHealthReport = {
  staleDays: number;
  openCount: number;
  totalsByCurrency: Record<string, number>;
  byStage: Array<{
    stageId: string;
    stageName: string;
    count: number;
    totalsByCurrency: Record<string, number>;
    avgAgeDays: number;
    staleCount: number;
  }>;
  staleDealsCount: number;
  winRate: number | null;
  winRateBreakdown?: {
    byOwner: Array<{ ownerUserId: string; won: number; lost: number; total: number; winRate: number | null }>;
    byTeamMember: Array<{ userId: string; won: number; lost: number; total: number; winRate: number | null }>;
    byStage: Array<{ stageId: string; stageName: string; won: number; lost: number; total: number; winRate: number | null }>;
  };
  winRateRange: { start: string | null; end: string | null };
};

export type StageTransitionMetrics = {
  range: { start: string | null; end: string | null };
  avgDaysInStage: Array<{ stageId: string; count: number; avgDays: number }>;
  transitions: Array<{ fromStageId: string | null; toStageId: string; count: number; avgDays: number }>;
};

export type FunnelReport = {
  range: { start: string | null; end: string | null };
  counts: {
    leads: number;
    contacts: number;
    opportunities: number;
    won: number;
    lost: number;
  };
  rates: {
    contactPerLead: number | null;
    opportunityPerContact: number | null;
    winRate: number | null;
  };
  stageTransitions?: StageTransitionMetrics;
};

export type ForecastReport = {
  range: { start: string | null; end: string | null };
  totalsByCurrency: Record<string, { raw: number; weighted: number; count: number }>;
  byWeek: Array<{ week: string; totalsByCurrency: Record<string, { raw: number; weighted: number; count: number }> }>;
};

export type ActivityReport = {
  range: { start: string | null; end: string | null };
  bucket: 'day' | 'week';
  totalsByUser: Record<string, { activities: number; tasksCreated: number; tasksCompleted: number }>;
  series: Array<{ bucketStart: string; activities: number; tasksCreated: number; tasksCompleted: number }>;
};

export const getPipelineHealth = async (params?: {
  staleDays?: number;
  closedStartDate?: string;
  closedEndDate?: string;
}): Promise<PipelineHealthReport> => {
  const res = await apiClient.get<PipelineHealthReport>('/crm/reports/pipeline-health', {
    params,
  });
  return res.data;
};

export const getFunnel = async (params?: {
  startDate?: string;
  endDate?: string;
}): Promise<FunnelReport> => {
  const res = await apiClient.get<FunnelReport>('/crm/reports/funnel', { params });
  return res.data;
};

export const getForecast = async (params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ForecastReport> => {
  const res = await apiClient.get<ForecastReport>('/crm/reports/forecast', { params });
  return res.data;
};

export const getActivity = async (params?: {
  startDate?: string;
  endDate?: string;
  bucket?: 'day' | 'week';
}): Promise<ActivityReport> => {
  const res = await apiClient.get<ActivityReport>('/crm/reports/activity', { params });
  return res.data;
};

export const downloadPipelineHealthCsv = async (params?: {
  staleDays?: number;
}): Promise<Blob> => {
  const res = await apiClient.get('/crm/reports/pipeline-health/export-csv', {
    params,
    responseType: 'blob',
    headers: {
      // Override JSON content-type, download endpoint returns CSV
      Accept: 'text/csv',
    },
  });
  return res.data as Blob;
};

export const downloadFunnelCsv = async (params?: {
  startDate?: string;
  endDate?: string;
}): Promise<Blob> => {
  const res = await apiClient.get('/crm/reports/funnel/export-csv', {
    params,
    responseType: 'blob',
    headers: {
      Accept: 'text/csv',
    },
  });
  return res.data as Blob;
};

export const downloadForecastCsv = async (params?: {
  startDate?: string;
  endDate?: string;
}): Promise<Blob> => {
  const res = await apiClient.get('/crm/reports/forecast/export-csv', {
    params,
    responseType: 'blob',
    headers: {
      Accept: 'text/csv',
    },
  });
  return res.data as Blob;
};

export const downloadActivityCsv = async (params?: {
  startDate?: string;
  endDate?: string;
  bucket?: 'day' | 'week';
}): Promise<Blob> => {
  const res = await apiClient.get('/crm/reports/activity/export-csv', {
    params,
    responseType: 'blob',
    headers: {
      Accept: 'text/csv',
    },
  });
  return res.data as Blob;
};
