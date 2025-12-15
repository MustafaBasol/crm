import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../common/decorators/user.decorator';
import type { CurrentUser } from '../common/decorators/user.decorator';
import { CrmService } from './crm.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { MoveOpportunityDto } from './dto/move-opportunity.dto';
import { SetOpportunityTeamDto } from './dto/set-opportunity-team.dto';

@ApiTags('crm')
@Controller('crm')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Post('pipeline/bootstrap')
  @ApiOperation({ summary: 'Bootstrap default pipeline (single pipeline for now)' })
  async bootstrap(@User() user: CurrentUser) {
    return this.crmService.bootstrapDefaultPipeline(user.tenantId);
  }

  @Get('board')
  @ApiOperation({ summary: 'Get pipeline board (stages + opportunities) scoped by visibility' })
  async board(@User() user: CurrentUser) {
    return this.crmService.getBoard(user.tenantId, user);
  }

  @Post('opportunities')
  @ApiOperation({ summary: 'Create opportunity (owner=user; team optional)' })
  async createOpportunity(@User() user: CurrentUser, @Body() dto: CreateOpportunityDto) {
    return this.crmService.createOpportunity(user.tenantId, user, dto);
  }

  @Post('opportunities/:id/move')
  @ApiOperation({ summary: 'Move opportunity to another stage' })
  async move(@User() user: CurrentUser, @Param('id') id: string, @Body() dto: MoveOpportunityDto) {
    return this.crmService.moveOpportunityStage(user.tenantId, user, id, dto);
  }

  @Post('opportunities/:id/team')
  @ApiOperation({ summary: 'Set opportunity team (owner is always included)' })
  async setTeam(@User() user: CurrentUser, @Param('id') id: string, @Body() dto: SetOpportunityTeamDto) {
    return this.crmService.setOpportunityTeam(user.tenantId, user, id, dto);
  }
}
