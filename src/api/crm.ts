import apiClient from './client';

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
  expectedCloseDate: string | null;
  status: 'open' | 'won' | 'lost';
  teamUserIds: string[];
};

export type CrmBoardResponse = {
  pipeline: { id: string; name: string } | null;
  stages: CrmStage[];
  opportunities: CrmOpportunity[];
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

export const getBoard = async (): Promise<CrmBoardResponse> => {
  const res = await apiClient.get<CrmBoardResponse>('/crm/board');
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
