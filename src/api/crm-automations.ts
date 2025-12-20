import apiClient from './client';

export type CrmAutomationAssigneeTarget = 'owner' | 'mover' | 'specific';

export type CrmAutomationStageTaskRule = {
  id: string;
  tenantId: string;
  enabled: boolean;
  fromStageId: string | null;
  toStageId: string;
  titleTemplate: string;
  dueInDays: number;
  assigneeTarget: CrmAutomationAssigneeTarget;
  assigneeUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CrmAutomationStaleDealRule = {
  id: string;
  tenantId: string;
  enabled: boolean;
  staleDays: number;
  stageId: string | null;
  titleTemplate: string;
  dueInDays: number;
  assigneeTarget: CrmAutomationAssigneeTarget;
  assigneeUserId: string | null;
  cooldownDays: number;
  createdAt: string;
  updatedAt: string;
};

export type CrmAutomationOverdueTaskRule = {
  id: string;
  tenantId: string;
  enabled: boolean;
  overdueDays: number;
  titleTemplate: string;
  dueInDays: number;
  assigneeTarget: CrmAutomationAssigneeTarget;
  assigneeUserId: string | null;
  cooldownDays: number;
  createdAt: string;
  updatedAt: string;
};

export type CrmAutomationStageSequenceItem = {
  titleTemplate: string;
  dueInDays: number;
};

export type CrmAutomationStageSequenceRule = {
  id: string;
  tenantId: string;
  enabled: boolean;
  fromStageId: string | null;
  toStageId: string;
  items: CrmAutomationStageSequenceItem[];
  assigneeTarget: CrmAutomationAssigneeTarget;
  assigneeUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CrmAutomationWonChecklistRule = {
  id: string;
  tenantId: string;
  enabled: boolean;
  titleTemplates: string[];
  dueInDays: number;
  assigneeTarget: CrmAutomationAssigneeTarget;
  assigneeUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export const crmAutomationsApi = {
  async listStageTaskRules(): Promise<{ items: CrmAutomationStageTaskRule[] }> {
    const res = await apiClient.get<{ items: CrmAutomationStageTaskRule[] }>(
      '/crm/automation/stage-task-rules',
    );
    return res.data;
  },

  async listStageSequenceRules(): Promise<{ items: CrmAutomationStageSequenceRule[] }> {
    const res = await apiClient.get<{ items: CrmAutomationStageSequenceRule[] }>(
      '/crm/automation/stage-sequence-rules',
    );
    return res.data;
  },

  async createStageSequenceRule(payload: {
    enabled?: boolean;
    fromStageId?: string | null;
    toStageId: string;
    items: CrmAutomationStageSequenceItem[];
    assigneeTarget?: CrmAutomationAssigneeTarget;
    assigneeUserId?: string | null;
  }): Promise<CrmAutomationStageSequenceRule> {
    const res = await apiClient.post<CrmAutomationStageSequenceRule>(
      '/crm/automation/stage-sequence-rules',
      payload,
    );
    return res.data;
  },

  async updateStageSequenceRule(
    id: string,
    payload: {
      enabled?: boolean;
      fromStageId?: string | null;
      toStageId?: string;
      items?: CrmAutomationStageSequenceItem[];
      assigneeTarget?: CrmAutomationAssigneeTarget;
      assigneeUserId?: string | null;
    },
  ): Promise<CrmAutomationStageSequenceRule> {
    const res = await apiClient.patch<CrmAutomationStageSequenceRule>(
      `/crm/automation/stage-sequence-rules/${encodeURIComponent(String(id))}`,
      payload,
    );
    return res.data;
  },

  async createStageTaskRule(payload: {
    enabled?: boolean;
    fromStageId?: string | null;
    toStageId: string;
    titleTemplate: string;
    dueInDays?: number;
    assigneeTarget?: CrmAutomationAssigneeTarget;
    assigneeUserId?: string | null;
  }): Promise<CrmAutomationStageTaskRule> {
    const res = await apiClient.post<CrmAutomationStageTaskRule>(
      '/crm/automation/stage-task-rules',
      payload,
    );
    return res.data;
  },

  async updateStageTaskRule(
    id: string,
    payload: {
      enabled?: boolean;
      fromStageId?: string | null;
      toStageId?: string;
      titleTemplate?: string;
      dueInDays?: number;
      assigneeTarget?: CrmAutomationAssigneeTarget;
      assigneeUserId?: string | null;
    },
  ): Promise<CrmAutomationStageTaskRule> {
    const res = await apiClient.patch<CrmAutomationStageTaskRule>(
      `/crm/automation/stage-task-rules/${encodeURIComponent(String(id))}`,
      payload,
    );
    return res.data;
  },

  async listStaleDealRules(): Promise<{ items: CrmAutomationStaleDealRule[] }> {
    const res = await apiClient.get<{ items: CrmAutomationStaleDealRule[] }>(
      '/crm/automation/stale-deal-rules',
    );
    return res.data;
  },

  async listOverdueTaskRules(): Promise<{ items: CrmAutomationOverdueTaskRule[] }> {
    const res = await apiClient.get<{ items: CrmAutomationOverdueTaskRule[] }>(
      '/crm/automation/overdue-task-rules',
    );
    return res.data;
  },

  async createOverdueTaskRule(payload: {
    enabled?: boolean;
    overdueDays: number;
    titleTemplate: string;
    dueInDays?: number;
    cooldownDays?: number;
    assigneeTarget?: CrmAutomationAssigneeTarget;
    assigneeUserId?: string | null;
  }): Promise<CrmAutomationOverdueTaskRule> {
    const res = await apiClient.post<CrmAutomationOverdueTaskRule>(
      '/crm/automation/overdue-task-rules',
      payload,
    );
    return res.data;
  },

  async updateOverdueTaskRule(
    id: string,
    payload: {
      enabled?: boolean;
      overdueDays?: number;
      titleTemplate?: string;
      dueInDays?: number;
      cooldownDays?: number;
      assigneeTarget?: CrmAutomationAssigneeTarget;
      assigneeUserId?: string | null;
    },
  ): Promise<CrmAutomationOverdueTaskRule> {
    const res = await apiClient.patch<CrmAutomationOverdueTaskRule>(
      `/crm/automation/overdue-task-rules/${encodeURIComponent(String(id))}`,
      payload,
    );
    return res.data;
  },

  async runOverdueTaskAutomations(): Promise<{
    rules: number;
    scannedOpportunities: number;
    createdTasks: number;
  }> {
    const res = await apiClient.post<{
      rules: number;
      scannedOpportunities: number;
      createdTasks: number;
    }>('/crm/automation/run/overdue-tasks');
    return res.data;
  },

  async createStaleDealRule(payload: {
    enabled?: boolean;
    staleDays: number;
    stageId?: string | null;
    titleTemplate: string;
    dueInDays?: number;
    cooldownDays?: number;
    assigneeTarget?: CrmAutomationAssigneeTarget;
    assigneeUserId?: string | null;
  }): Promise<CrmAutomationStaleDealRule> {
    const res = await apiClient.post<CrmAutomationStaleDealRule>(
      '/crm/automation/stale-deal-rules',
      payload,
    );
    return res.data;
  },

  async updateStaleDealRule(
    id: string,
    payload: {
      enabled?: boolean;
      staleDays?: number;
      stageId?: string | null;
      titleTemplate?: string;
      dueInDays?: number;
      cooldownDays?: number;
      assigneeTarget?: CrmAutomationAssigneeTarget;
      assigneeUserId?: string | null;
    },
  ): Promise<CrmAutomationStaleDealRule> {
    const res = await apiClient.patch<CrmAutomationStaleDealRule>(
      `/crm/automation/stale-deal-rules/${encodeURIComponent(String(id))}`,
      payload,
    );
    return res.data;
  },

  async listWonChecklistRules(): Promise<{ items: CrmAutomationWonChecklistRule[] }> {
    const res = await apiClient.get<{ items: CrmAutomationWonChecklistRule[] }>(
      '/crm/automation/won-checklist-rules',
    );
    return res.data;
  },

  async createWonChecklistRule(payload: {
    enabled?: boolean;
    titleTemplates: string[];
    dueInDays?: number;
    assigneeTarget?: CrmAutomationAssigneeTarget;
    assigneeUserId?: string | null;
  }): Promise<CrmAutomationWonChecklistRule> {
    const res = await apiClient.post<CrmAutomationWonChecklistRule>(
      '/crm/automation/won-checklist-rules',
      payload,
    );
    return res.data;
  },

  async updateWonChecklistRule(
    id: string,
    payload: {
      enabled?: boolean;
      titleTemplates?: string[];
      dueInDays?: number;
      assigneeTarget?: CrmAutomationAssigneeTarget;
      assigneeUserId?: string | null;
    },
  ): Promise<CrmAutomationWonChecklistRule> {
    const res = await apiClient.patch<CrmAutomationWonChecklistRule>(
      `/crm/automation/won-checklist-rules/${encodeURIComponent(String(id))}`,
      payload,
    );
    return res.data;
  },
};
