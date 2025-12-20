import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../common/decorators/user.decorator';
import type { CurrentUser } from '../common/decorators/user.decorator';
import { CrmService } from './crm.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { CreateActivityDto } from './dto/create-activity.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { MoveOpportunityDto } from './dto/move-opportunity.dto';
import { SetOpportunityTeamDto } from './dto/set-opportunity-team.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CreateAutomationStageTaskRuleDto } from './dto/create-automation-stage-task-rule.dto';
import { UpdateAutomationStageTaskRuleDto } from './dto/update-automation-stage-task-rule.dto';
import { CreateAutomationStageSequenceRuleDto } from './dto/create-automation-stage-sequence-rule.dto';
import { UpdateAutomationStageSequenceRuleDto } from './dto/update-automation-stage-sequence-rule.dto';
import { CreateAutomationStaleDealRuleDto } from './dto/create-automation-stale-deal-rule.dto';
import { UpdateAutomationStaleDealRuleDto } from './dto/update-automation-stale-deal-rule.dto';
import { CreateAutomationOverdueTaskRuleDto } from './dto/create-automation-overdue-task-rule.dto';
import { UpdateAutomationOverdueTaskRuleDto } from './dto/update-automation-overdue-task-rule.dto';
import { CreateAutomationWonChecklistRuleDto } from './dto/create-automation-won-checklist-rule.dto';
import { UpdateAutomationWonChecklistRuleDto } from './dto/update-automation-won-checklist-rule.dto';
import { CrmOpportunityStatus } from './entities/crm-opportunity.entity';

type CsvPrimitive = string | number | boolean | Date | null | undefined;
const serializeCsvValue = (value: CsvPrimitive): string => {
  if (value == null) return '';
  const serialized =
    value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n]/.test(serialized)) {
    return '"' + serialized.replace(/"/g, '""') + '"';
  }
  return serialized;
};

type PipelineHealthByStageRow = {
  stageId: string;
  stageName: string;
  count: number;
  totalsByCurrency: Record<string, number>;
  avgAgeDays: number;
  staleCount: number;
};

type PipelineHealthReport = {
  staleDays: number;
  byStage: PipelineHealthByStageRow[];
};

type ForecastWeekRow = {
  week: string;
  totalsByCurrency: Record<
    string,
    { raw: number; weighted: number; count: number }
  >;
};

type ForecastReport = {
  byWeek: ForecastWeekRow[];
};

type ActivitySeriesRow = {
  bucketStart: string;
  activities: number;
  tasksCreated: number;
  tasksCompleted: number;
};

type ActivityReport = {
  bucket: 'day' | 'week';
  series: ActivitySeriesRow[];
};

@ApiTags('crm')
@Controller('crm')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get('reports/pipeline-health')
  @ApiOperation({
    summary:
      'Pipeline health report (open deals; stage distribution; stale deals; win rate)',
  })
  async pipelineHealth(
    @User() user: CurrentUser,
    @Query('staleDays') staleDays?: string,
    @Query('closedStartDate') closedStartDate?: string,
    @Query('closedEndDate') closedEndDate?: string,
  ) {
    return this.crmService.getPipelineHealthReport(user.tenantId, user, {
      staleDays: staleDays ? Number(staleDays) : undefined,
      closedStartDate,
      closedEndDate,
    });
  }

  @Get('reports/funnel')
  @ApiOperation({
    summary:
      'Funnel report (counts: leads/contacts/opportunities/won/lost) for a date range',
  })
  async funnel(
    @User() user: CurrentUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.crmService.getFunnelReport(user.tenantId, user, {
      startDate,
      endDate,
    });
  }

  @Get('reports/forecast')
  @ApiOperation({
    summary:
      'Forecast report (weighted by expectedCloseDate and probability) for a date range',
  })
  async forecast(
    @User() user: CurrentUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.crmService.getForecastReport(user.tenantId, user, {
      startDate,
      endDate,
    });
  }

  @Get('reports/activity')
  @ApiOperation({
    summary:
      'Activity metrics (user/team daily/weekly activity/task volume) for a date range',
  })
  async activity(
    @User() user: CurrentUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('bucket') bucket?: 'day' | 'week',
  ) {
    return this.crmService.getActivityReport(user.tenantId, user, {
      startDate,
      endDate,
      bucket,
    });
  }

  @Get('reports/pipeline-health/export-csv')
  @ApiOperation({ summary: 'Export pipeline health report as CSV' })
  async exportPipelineHealthCsv(
    @User() user: CurrentUser,
    @Res() res: Response,
    @Query('staleDays') staleDays?: string,
  ) {
    const report = (await this.crmService.getPipelineHealthReport(
      user.tenantId,
      user,
      {
        staleDays: staleDays ? Number(staleDays) : undefined,
      },
    )) as unknown as PipelineHealthReport;

    await this.crmService.logReportExport(user.tenantId, user, {
      report: 'pipeline-health',
      params: { staleDays: report.staleDays },
    });

    const headersRow = [
      'Stage',
      'Count',
      'Avg Age (days)',
      'Stale Count',
      'Totals By Currency (JSON)',
    ];
    const rows = (Array.isArray(report.byStage) ? report.byStage : []).map(
      (row) => {
        return [
          row.stageName,
          row.count,
          row.avgAgeDays,
          row.staleCount,
          JSON.stringify(row.totalsByCurrency || {}),
        ]
          .map(serializeCsvValue)
          .join(',');
      },
    );

    const csv = '\uFEFF' + [headersRow.join(','), ...rows].join('\n');
    const filename = `crm_pipeline_health_${user.tenantId}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  }

  @Get('reports/funnel/export-csv')
  @ApiOperation({ summary: 'Export funnel report as CSV' })
  async exportFunnelCsv(
    @User() user: CurrentUser,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const report = await this.crmService.getFunnelReport(user.tenantId, user, {
      startDate,
      endDate,
    });

    await this.crmService.logReportExport(user.tenantId, user, {
      report: 'funnel',
      params: { startDate, endDate },
    });

    const headersRow = ['Section', 'Key', 'Value', 'Extra'];
    const rows: string[] = [];

    rows.push(
      ['Counts', 'Leads', report.counts.leads, null]
        .map(serializeCsvValue)
        .join(','),
    );
    rows.push(
      ['Counts', 'Contacts', report.counts.contacts, null]
        .map(serializeCsvValue)
        .join(','),
    );
    rows.push(
      ['Counts', 'Opportunities', report.counts.opportunities, null]
        .map(serializeCsvValue)
        .join(','),
    );
    rows.push(
      ['Counts', 'Won', report.counts.won, null]
        .map(serializeCsvValue)
        .join(','),
    );
    rows.push(
      ['Counts', 'Lost', report.counts.lost, null]
        .map(serializeCsvValue)
        .join(','),
    );

    rows.push(
      ['Rates', 'Contact per Lead', report.rates.contactPerLead, null]
        .map(serializeCsvValue)
        .join(','),
    );
    rows.push(
      [
        'Rates',
        'Opportunity per Contact',
        report.rates.opportunityPerContact,
        null,
      ]
        .map(serializeCsvValue)
        .join(','),
    );
    rows.push(
      ['Rates', 'Win Rate', report.rates.winRate, null]
        .map(serializeCsvValue)
        .join(','),
    );

    if (report.stageTransitions) {
      for (const r of report.stageTransitions.avgDaysInStage || []) {
        rows.push(
          ['Stage Avg Days', r.stageId, r.avgDays, `count=${r.count}`]
            .map(serializeCsvValue)
            .join(','),
        );
      }
      for (const tr of report.stageTransitions.transitions || []) {
        rows.push(
          [
            'Stage Transitions',
            `${tr.fromStageId ?? 'null'} -> ${tr.toStageId}`,
            tr.avgDays,
            `count=${tr.count}`,
          ]
            .map(serializeCsvValue)
            .join(','),
        );
      }
    }

    const csv = '\uFEFF' + [headersRow.join(','), ...rows].join('\n');
    const filename = `crm_funnel_${user.tenantId}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  }

  @Get('reports/forecast/export-csv')
  @ApiOperation({ summary: 'Export forecast report as CSV' })
  async exportForecastCsv(
    @User() user: CurrentUser,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const report = (await this.crmService.getForecastReport(
      user.tenantId,
      user,
      {
        startDate,
        endDate,
      },
    )) as unknown as ForecastReport;

    await this.crmService.logReportExport(user.tenantId, user, {
      report: 'forecast',
      params: { startDate, endDate },
    });

    const headersRow = ['Week', 'Currency', 'Raw', 'Weighted', 'Count'];
    const rows: string[] = [];

    for (const w of Array.isArray(report.byWeek) ? report.byWeek : []) {
      const week = String(w.week || '');
      const totals = w.totalsByCurrency || {};
      for (const [ccy, v] of Object.entries(totals)) {
        const raw = Number(v?.raw) || 0;
        const weighted = Number(v?.weighted) || 0;
        const count = Number(v?.count) || 0;
        rows.push(
          [week, ccy, raw, weighted, count].map(serializeCsvValue).join(','),
        );
      }
    }

    const csv = '\uFEFF' + [headersRow.join(','), ...rows].join('\n');
    const filename = `crm_forecast_${user.tenantId}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  }

  @Get('reports/activity/export-csv')
  @ApiOperation({ summary: 'Export activity report as CSV' })
  async exportActivityCsv(
    @User() user: CurrentUser,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('bucket') bucket?: 'day' | 'week',
  ) {
    const report = (await this.crmService.getActivityReport(
      user.tenantId,
      user,
      {
        startDate,
        endDate,
        bucket,
      },
    )) as unknown as ActivityReport;

    await this.crmService.logReportExport(user.tenantId, user, {
      report: 'activity',
      params: { startDate, endDate, bucket: report.bucket },
    });

    const headersRow = [
      'BucketStart',
      'Activities',
      'TasksCreated',
      'TasksCompleted',
    ];
    const rows = (Array.isArray(report.series) ? report.series : []).map(
      (r) => {
        return [r.bucketStart, r.activities, r.tasksCreated, r.tasksCompleted]
          .map(serializeCsvValue)
          .join(',');
      },
    );

    const csv = '\uFEFF' + [headersRow.join(','), ...rows].join('\n');
    const filename = `crm_activity_${user.tenantId}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  }

  @Get('leads')
  @ApiOperation({ summary: 'List CRM leads' })
  async listLeads(
    @User() user: CurrentUser,
    @Query('q') q?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.crmService.listLeads(user.tenantId, {
      q,
      startDate,
      endDate,
      sortBy,
      sortDir,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('leads')
  @ApiOperation({ summary: 'Create CRM lead' })
  async createLead(@User() user: CurrentUser, @Body() dto: CreateLeadDto) {
    return this.crmService.createLead(user.tenantId, user, dto);
  }

  @Patch('leads/:id')
  @ApiOperation({ summary: 'Update CRM lead' })
  async updateLead(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.crmService.updateLead(user.tenantId, user, id, dto);
  }

  @Delete('leads/:id')
  @ApiOperation({ summary: 'Delete CRM lead' })
  async deleteLead(@User() user: CurrentUser, @Param('id') id: string) {
    return this.crmService.deleteLead(user.tenantId, user, id);
  }

  @Get('contacts')
  @ApiOperation({ summary: 'List CRM contacts' })
  async listContacts(
    @User() user: CurrentUser,
    @Query('accountId') accountId?: string,
    @Query('q') q?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.crmService.listContacts(user.tenantId, user, {
      accountId,
      q,
      startDate,
      endDate,
      sortBy,
      sortDir,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('contacts')
  @ApiOperation({ summary: 'Create CRM contact' })
  async createContact(
    @User() user: CurrentUser,
    @Body() dto: CreateContactDto,
  ) {
    return this.crmService.createContact(user.tenantId, user, dto);
  }

  @Patch('contacts/:id')
  @ApiOperation({ summary: 'Update CRM contact' })
  async updateContact(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.crmService.updateContact(user.tenantId, user, id, dto);
  }

  @Delete('contacts/:id')
  @ApiOperation({ summary: 'Delete CRM contact' })
  async deleteContact(@User() user: CurrentUser, @Param('id') id: string) {
    return this.crmService.deleteContact(user.tenantId, user, id);
  }

  @Post('pipeline/bootstrap')
  @ApiOperation({
    summary: 'Bootstrap default pipeline (single pipeline for now)',
  })
  async bootstrap(@User() user: CurrentUser) {
    return this.crmService.bootstrapDefaultPipeline(user.tenantId);
  }

  @Get('stages')
  @ApiOperation({ summary: 'List default pipeline stages' })
  async listStages(@User() user: CurrentUser) {
    return this.crmService.listStages(user.tenantId);
  }

  // === Automation (simple rule engine) ===
  @Get('automation/stage-task-rules')
  @ApiOperation({
    summary: 'List automation rules: stage change -> create task',
  })
  async listAutomationStageTaskRules(@User() user: CurrentUser) {
    return this.crmService.listAutomationStageTaskRules(user.tenantId, user);
  }

  @Post('automation/stage-task-rules')
  @ApiOperation({
    summary: 'Create automation rule: stage change -> create task',
  })
  async createAutomationStageTaskRule(
    @User() user: CurrentUser,
    @Body() dto: CreateAutomationStageTaskRuleDto,
  ) {
    return this.crmService.createAutomationStageTaskRule(
      user.tenantId,
      user,
      dto,
    );
  }

  @Patch('automation/stage-task-rules/:id')
  @ApiOperation({
    summary: 'Update automation rule: stage change -> create task',
  })
  async updateAutomationStageTaskRule(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationStageTaskRuleDto,
  ) {
    return this.crmService.updateAutomationStageTaskRule(
      user.tenantId,
      user,
      id,
      dto,
    );
  }

  @Get('automation/stage-sequence-rules')
  @ApiOperation({
    summary: 'List automation rules: stage change -> create sequence tasks',
  })
  async listAutomationStageSequenceRules(@User() user: CurrentUser) {
    return this.crmService.listAutomationStageSequenceRules(
      user.tenantId,
      user,
    );
  }

  @Post('automation/stage-sequence-rules')
  @ApiOperation({
    summary: 'Create automation rule: stage change -> create sequence tasks',
  })
  async createAutomationStageSequenceRule(
    @User() user: CurrentUser,
    @Body() dto: CreateAutomationStageSequenceRuleDto,
  ) {
    return this.crmService.createAutomationStageSequenceRule(
      user.tenantId,
      user,
      dto,
    );
  }

  @Patch('automation/stage-sequence-rules/:id')
  @ApiOperation({
    summary: 'Update automation rule: stage change -> create sequence tasks',
  })
  async updateAutomationStageSequenceRule(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationStageSequenceRuleDto,
  ) {
    return this.crmService.updateAutomationStageSequenceRule(
      user.tenantId,
      user,
      id,
      dto,
    );
  }

  @Get('automation/stale-deal-rules')
  @ApiOperation({ summary: 'List automation rules: stale deal -> create task' })
  async listAutomationStaleDealRules(@User() user: CurrentUser) {
    return this.crmService.listAutomationStaleDealRules(user.tenantId, user);
  }

  @Get('automation/won-checklist-rules')
  @ApiOperation({
    summary: 'List automation rules: WON -> create checklist tasks',
  })
  async listAutomationWonChecklistRules(@User() user: CurrentUser) {
    return this.crmService.listAutomationWonChecklistRules(user.tenantId, user);
  }

  @Post('automation/won-checklist-rules')
  @ApiOperation({
    summary: 'Create automation rule: WON -> create checklist tasks',
  })
  async createAutomationWonChecklistRule(
    @User() user: CurrentUser,
    @Body() dto: CreateAutomationWonChecklistRuleDto,
  ) {
    return this.crmService.createAutomationWonChecklistRule(
      user.tenantId,
      user,
      dto,
    );
  }

  @Patch('automation/won-checklist-rules/:id')
  @ApiOperation({
    summary: 'Update automation rule: WON -> create checklist tasks',
  })
  async updateAutomationWonChecklistRule(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationWonChecklistRuleDto,
  ) {
    return this.crmService.updateAutomationWonChecklistRule(
      user.tenantId,
      user,
      id,
      dto,
    );
  }

  @Post('automation/stale-deal-rules')
  @ApiOperation({
    summary: 'Create automation rule: stale deal -> create task',
  })
  async createAutomationStaleDealRule(
    @User() user: CurrentUser,
    @Body() dto: CreateAutomationStaleDealRuleDto,
  ) {
    return this.crmService.createAutomationStaleDealRule(
      user.tenantId,
      user,
      dto,
    );
  }

  @Patch('automation/stale-deal-rules/:id')
  @ApiOperation({
    summary: 'Update automation rule: stale deal -> create task',
  })
  async updateAutomationStaleDealRule(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationStaleDealRuleDto,
  ) {
    return this.crmService.updateAutomationStaleDealRule(
      user.tenantId,
      user,
      id,
      dto,
    );
  }

  @Post('automation/run/stale-deals')
  @ApiOperation({
    summary: 'Run stale deal automation rules (best-effort) for current tenant',
  })
  async runAutomationStaleDeals(@User() user: CurrentUser) {
    return this.crmService.runStaleDealAutomations(user.tenantId, user);
  }

  @Get('automation/overdue-task-rules')
  @ApiOperation({
    summary: 'List automation rules: overdue tasks -> create escalation task',
  })
  async listAutomationOverdueTaskRules(@User() user: CurrentUser) {
    return this.crmService.listAutomationOverdueTaskRules(user.tenantId, user);
  }

  @Post('automation/overdue-task-rules')
  @ApiOperation({
    summary: 'Create automation rule: overdue tasks -> create escalation task',
  })
  async createAutomationOverdueTaskRule(
    @User() user: CurrentUser,
    @Body() dto: CreateAutomationOverdueTaskRuleDto,
  ) {
    return this.crmService.createAutomationOverdueTaskRule(
      user.tenantId,
      user,
      dto,
    );
  }

  @Patch('automation/overdue-task-rules/:id')
  @ApiOperation({
    summary: 'Update automation rule: overdue tasks -> create escalation task',
  })
  async updateAutomationOverdueTaskRule(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationOverdueTaskRuleDto,
  ) {
    return this.crmService.updateAutomationOverdueTaskRule(
      user.tenantId,
      user,
      id,
      dto,
    );
  }

  @Post('automation/run/overdue-tasks')
  @ApiOperation({
    summary:
      'Run overdue task automation rules (best-effort) for current tenant',
  })
  async runAutomationOverdueTasks(@User() user: CurrentUser) {
    return this.crmService.runOverdueTaskAutomations(user.tenantId, user);
  }

  @Get('board')
  @ApiOperation({
    summary: 'Get pipeline board (stages + opportunities) scoped by visibility',
  })
  async board(@User() user: CurrentUser) {
    return this.crmService.getBoard(user.tenantId, user);
  }

  @Post('opportunities')
  @ApiOperation({ summary: 'Create opportunity (owner=user; team optional)' })
  async createOpportunity(
    @User() user: CurrentUser,
    @Body() dto: CreateOpportunityDto,
  ) {
    return this.crmService.createOpportunity(user.tenantId, user, dto);
  }

  @Get('opportunities')
  @ApiOperation({
    summary: 'List opportunities (scoped by visibility; supports pagination)',
  })
  async listOpportunities(
    @User() user: CurrentUser,
    @Query('q') q?: string,
    @Query('stageId') stageId?: string,
    @Query('accountId') accountId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const statusValue: CrmOpportunityStatus | undefined =
      status === CrmOpportunityStatus.OPEN ||
      status === CrmOpportunityStatus.WON ||
      status === CrmOpportunityStatus.LOST
        ? (status as CrmOpportunityStatus)
        : undefined;

    return this.crmService.listOpportunities(user.tenantId, user, {
      q,
      stageId,
      accountId,
      status: statusValue,
      startDate,
      endDate,
      sortBy,
      sortDir,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('opportunities/:id')
  @ApiOperation({ summary: 'Get opportunity by id (scoped by visibility)' })
  async getOpportunity(@User() user: CurrentUser, @Param('id') id: string) {
    return this.crmService.getOpportunity(user.tenantId, user, id);
  }

  @Get('opportunities/:id/sales')
  @ApiOperation({
    summary:
      'List sales linked to an opportunity (via quotes.sourceQuoteId; scoped by visibility)',
  })
  async getOpportunitySales(
    @User() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.crmService.listOpportunitySales(user.tenantId, user, id);
  }

  @Get('opportunities/:id/invoices')
  @ApiOperation({
    summary:
      'List invoices linked to an opportunity (via quotes.sourceQuoteId; scoped by visibility)',
  })
  async getOpportunityInvoices(
    @User() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.crmService.listOpportunityInvoices(user.tenantId, user, id);
  }

  @Post('opportunities/:id/move')
  @ApiOperation({ summary: 'Move opportunity to another stage' })
  async move(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: MoveOpportunityDto,
  ) {
    return this.crmService.moveOpportunityStage(user.tenantId, user, id, dto);
  }

  @Post('opportunities/:id/team')
  @ApiOperation({ summary: 'Set opportunity team (owner is always included)' })
  async setTeam(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: SetOpportunityTeamDto,
  ) {
    return this.crmService.setOpportunityTeam(user.tenantId, user, id, dto);
  }

  @Patch('opportunities/:id')
  @ApiOperation({
    summary:
      'Update opportunity fields (name, account, amount, currency, expectedCloseDate)',
  })
  async updateOpportunity(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateOpportunityDto,
  ) {
    return this.crmService.updateOpportunity(user.tenantId, user, id, dto);
  }

  @Get('activities')
  @ApiOperation({
    summary: 'List CRM activities (optionally filtered by opportunityId)',
  })
  async listActivities(
    @User() user: CurrentUser,
    @Query('opportunityId') opportunityId?: string,
    @Query('accountId') accountId?: string,
    @Query('contactId') contactId?: string,
    @Query('q') q?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.crmService.listActivities(user.tenantId, user, {
      opportunityId,
      accountId,
      contactId,
      q,
      startDate,
      endDate,
      sortBy,
      sortDir,
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('activities')
  @ApiOperation({ summary: 'Create CRM activity' })
  async createActivity(
    @User() user: CurrentUser,
    @Body() dto: CreateActivityDto,
  ) {
    return this.crmService.createActivity(user.tenantId, user, dto);
  }

  @Patch('activities/:id')
  @ApiOperation({ summary: 'Update CRM activity' })
  async updateActivity(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.crmService.updateActivity(user.tenantId, user, id, dto);
  }

  @Delete('activities/:id')
  @ApiOperation({ summary: 'Delete CRM activity' })
  async deleteActivity(@User() user: CurrentUser, @Param('id') id: string) {
    return this.crmService.deleteActivity(user.tenantId, user, id);
  }

  @Get('tasks')
  @ApiOperation({
    summary:
      'List CRM tasks (optionally filtered by opportunityId or accountId)',
  })
  async listTasks(
    @User() user: CurrentUser,
    @Query('opportunityId') opportunityId?: string,
    @Query('accountId') accountId?: string,
    @Query('q') q?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.crmService.listTasks(user.tenantId, user, {
      opportunityId,
      accountId,
      q,
      startDate,
      endDate,
      sortBy,
      sortDir,
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('tasks')
  @ApiOperation({ summary: 'Create CRM task' })
  async createTask(@User() user: CurrentUser, @Body() dto: CreateTaskDto) {
    return this.crmService.createTask(user.tenantId, user, dto);
  }

  @Patch('tasks/:id')
  @ApiOperation({ summary: 'Update CRM task' })
  async updateTask(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.crmService.updateTask(user.tenantId, user, id, dto);
  }

  @Delete('tasks/:id')
  @ApiOperation({ summary: 'Delete CRM task' })
  async deleteTask(@User() user: CurrentUser, @Param('id') id: string) {
    return this.crmService.deleteTask(user.tenantId, user, id);
  }
}
