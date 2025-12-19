import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
import { CrmOpportunityStatus } from './entities/crm-opportunity.entity';

@ApiTags('crm')
@Controller('crm')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get('leads')
  @ApiOperation({ summary: 'List CRM leads' })
  async listLeads(
    @User() user: CurrentUser,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.crmService.listLeads(user.tenantId, {
      q,
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
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.crmService.listContacts(user.tenantId, user, {
      accountId,
      q,
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
