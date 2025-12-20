import apiClient from './client';
import type { SaleRecord } from './sales';
import type { Invoice } from './invoices';

export type CrmOpportunityLinkedSale = SaleRecord & {
  sourceQuoteNumber?: string | null;
};

export type CrmOpportunityLinkedInvoice = Invoice & {
  sourceQuoteNumber?: string | null;
};

export type CrmStage = {
  id: string;
  name: string;
  order: number;
  isClosedWon: boolean;
  isClosedLost: boolean;
};

export type CrmOpportunity = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  stageId: string;
  accountId: string;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
  expectedCloseDate: string | null;
  status: 'open' | 'won' | 'lost';
  teamUserIds: string[];
};

export type CrmOpportunityListResponse = {
  items: CrmOpportunity[];
  total: number;
  limit: number;
  offset: number;
};

export type CrmGlobalSearchResponse = {
  q: string;
  limit: number;
  accounts: { items: Array<{ id: string; name: string }> };
  contacts: {
    items: Array<{
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      company: string | null;
      accountId: string | null;
      updatedAt: string;
    }>;
  };
  leads: {
    items: Array<{
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      company: string | null;
      status: string | null;
      updatedAt: string;
    }>;
  };
  opportunities: {
    items: Array<{
      id: string;
      name: string;
      stageId: string;
      status: 'open' | 'won' | 'lost';
      updatedAt: string;
      accountId: string | null;
    }>;
  };
  tasks: {
    items: Array<{
      id: string;
      title: string;
      completed: boolean;
      dueAt: string | null;
      opportunityId: string | null;
      accountId: string | null;
      updatedAt: string;
    }>;
  };
  activities: {
    items: Array<{
      id: string;
      title: string;
      type: string | null;
      completed: boolean;
      dueAt: string | null;
      opportunityId: string | null;
      accountId: string | null;
      updatedAt: string;
    }>;
  };
};

export type CreateOpportunityRequest = {
  accountId: string;
  name: string;
  amount: number;
  currency: string;
  expectedCloseDate?: string;
  stageId?: string;
  teamUserIds?: string[];
};

export type UpdateOpportunityRequest = Partial<Pick<CrmOpportunity, 'name' | 'amount' | 'currency' | 'accountId' | 'expectedCloseDate'>>;

export const bootstrapPipeline = async () => {
  const res = await apiClient.post('/crm/pipeline/bootstrap');
  return res.data;
};

export const getStages = async (): Promise<CrmStage[]> => {
  const res = await apiClient.get<CrmStage[]>('/crm/stages');
  return res.data;
};

export const getOpportunity = async (opportunityId: string): Promise<CrmOpportunity> => {
  const res = await apiClient.get<CrmOpportunity>(`/crm/opportunities/${opportunityId}`);
  return res.data;
};

export const listOpportunities = async (params?: {
  q?: string;
  ownerUserId?: string;
  stageId?: string;
  accountId?: string;
  status?: 'open' | 'won' | 'lost';
  amountMin?: number;
  amountMax?: number;
  startDate?: string;
  endDate?: string;
  sortBy?: 'updatedAt' | 'createdAt' | 'name';
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}): Promise<CrmOpportunityListResponse> => {
  const search = new URLSearchParams();
  if (params?.q) search.set('q', params.q);
  if (params?.stageId) search.set('stageId', params.stageId);
  if (params?.accountId) search.set('accountId', params.accountId);
  if (params?.ownerUserId) search.set('ownerUserId', params.ownerUserId);
  if (typeof params?.amountMin === 'number' && Number.isFinite(params.amountMin)) {
    search.set('amountMin', String(params.amountMin));
  }
  if (typeof params?.amountMax === 'number' && Number.isFinite(params.amountMax)) {
    search.set('amountMax', String(params.amountMax));
  }
  if (params?.startDate) search.set('startDate', params.startDate);
  if (params?.endDate) search.set('endDate', params.endDate);
  if (params?.sortBy) search.set('sortBy', params.sortBy);
  if (params?.sortDir) search.set('sortDir', params.sortDir);
  if (typeof params?.limit === 'number') search.set('limit', String(params.limit));
  if (typeof params?.offset === 'number') search.set('offset', String(params.offset));

  const suffix = search.toString();
  const res = await apiClient.get<CrmOpportunityListResponse>(`/crm/opportunities${suffix ? `?${suffix}` : ''}`);
  return res.data;
};

export const createOpportunity = async (data: CreateOpportunityRequest): Promise<CrmOpportunity> => {
  const res = await apiClient.post<CrmOpportunity>('/crm/opportunities', data);
  return res.data;
};

export const moveOpportunity = async (opportunityId: string, stageId: string): Promise<CrmOpportunity> => {
  const res = await apiClient.post<CrmOpportunity>(`/crm/opportunities/${opportunityId}/move`, { stageId });
  return res.data;
};

export const setOpportunityTeam = async (opportunityId: string, userIds: string[]): Promise<CrmOpportunity> => {
  const res = await apiClient.post<CrmOpportunity>(`/crm/opportunities/${opportunityId}/team`, { userIds });
  return res.data;
};

export const updateOpportunity = async (opportunityId: string, data: UpdateOpportunityRequest): Promise<CrmOpportunity> => {
  const res = await apiClient.patch<CrmOpportunity>(`/crm/opportunities/${opportunityId}`, data);
  return res.data;
};

export const getOpportunitySales = async (opportunityId: string): Promise<CrmOpportunityLinkedSale[]> => {
  const res = await apiClient.get<CrmOpportunityLinkedSale[]>(
    `/crm/opportunities/${encodeURIComponent(String(opportunityId))}/sales`
  );
  return res.data;
};

export const getOpportunityInvoices = async (opportunityId: string): Promise<CrmOpportunityLinkedInvoice[]> => {
  const res = await apiClient.get<CrmOpportunityLinkedInvoice[]>(
    `/crm/opportunities/${encodeURIComponent(String(opportunityId))}/invoices`
  );
  return res.data;
};

export const globalSearch = async (params: {
  q: string;
  limit?: number;
}): Promise<CrmGlobalSearchResponse> => {
  const res = await apiClient.get<CrmGlobalSearchResponse>('/crm/search', {
    params: { q: params.q, limit: params.limit },
  });
  return res.data;
};
