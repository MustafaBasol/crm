import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CrmPipeline } from './entities/crm-pipeline.entity';
import { CrmStage } from './entities/crm-stage.entity';
import {
  CrmOpportunity,
  CrmOpportunityStatus,
} from './entities/crm-opportunity.entity';
import { CrmOpportunityMember } from './entities/crm-opportunity-member.entity';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { MoveOpportunityDto } from './dto/move-opportunity.dto';
import { SetOpportunityTeamDto } from './dto/set-opportunity-team.dto';
import type { CurrentUser } from '../common/decorators/user.decorator';
import { UserRole } from '../users/entities/user.entity';

const DEFAULT_PIPELINE_NAME = 'Default Pipeline';
const DEFAULT_STAGES = [
  { name: 'Lead', order: 10 },
  { name: 'Qualified', order: 20 },
  { name: 'Proposal', order: 30 },
  { name: 'Negotiation', order: 40 },
  { name: 'Won', order: 90, isClosedWon: true },
  { name: 'Lost', order: 100, isClosedLost: true },
] as const;

@Injectable()
export class CrmService {
  constructor(
    @InjectRepository(CrmPipeline)
    private readonly pipelineRepo: Repository<CrmPipeline>,
    @InjectRepository(CrmStage)
    private readonly stageRepo: Repository<CrmStage>,
    @InjectRepository(CrmOpportunity)
    private readonly oppRepo: Repository<CrmOpportunity>,
    @InjectRepository(CrmOpportunityMember)
    private readonly oppMemberRepo: Repository<CrmOpportunityMember>,
  ) {}

  private isAdmin(user: CurrentUser): boolean {
    return (
      user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.TENANT_ADMIN
    );
  }

  async bootstrapDefaultPipeline(tenantId: string) {
    const existing = await this.pipelineRepo.findOne({
      where: { tenantId, isDefault: true },
    });
    if (existing) {
      const stages = await this.stageRepo.find({
        where: { tenantId, pipelineId: existing.id },
        order: { order: 'ASC' },
      });
      return { pipelineId: existing.id, stageIds: stages.map((s) => s.id) };
    }

    const created = await this.pipelineRepo.save(
      this.pipelineRepo.create({
        tenantId,
        name: DEFAULT_PIPELINE_NAME,
        isDefault: true,
      }),
    );

    const stageEntities = DEFAULT_STAGES.map((s) =>
      this.stageRepo.create({
        tenantId,
        pipelineId: created.id,
        name: s.name,
        order: s.order,
        isClosedWon: Boolean((s as any).isClosedWon),
        isClosedLost: Boolean((s as any).isClosedLost),
      }),
    );

    const savedStages = await this.stageRepo.save(stageEntities);
    return { pipelineId: created.id, stageIds: savedStages.map((s) => s.id) };
  }

  async getDefaultPipeline(tenantId: string) {
    const pipeline = await this.pipelineRepo.findOne({
      where: { tenantId, isDefault: true },
    });
    if (!pipeline) {
      return null;
    }
    const stages = await this.stageRepo.find({
      where: { tenantId, pipelineId: pipeline.id },
      order: { order: 'ASC' },
    });
    return { pipeline, stages };
  }

  async createOpportunity(tenantId: string, user: CurrentUser, dto: CreateOpportunityDto) {
    const pipeline = await this.pipelineRepo.findOne({
      where: { tenantId, isDefault: true },
    });
    if (!pipeline) {
      throw new BadRequestException('Default pipeline is not initialized');
    }

    let stageId = dto.stageId;
    if (!stageId) {
      const firstStage = await this.stageRepo.findOne({
        where: { tenantId, pipelineId: pipeline.id },
        order: { order: 'ASC' },
      });
      if (!firstStage) {
        throw new BadRequestException('Pipeline has no stages');
      }
      stageId = firstStage.id;
    }

    const stage = await this.stageRepo.findOne({
      where: { tenantId, id: stageId, pipelineId: pipeline.id },
    });
    if (!stage) {
      throw new BadRequestException('Invalid stage for default pipeline');
    }

    const expectedCloseDate = dto.expectedCloseDate
      ? new Date(dto.expectedCloseDate)
      : null;

    const opp = await this.oppRepo.save(
      this.oppRepo.create({
        tenantId,
        pipelineId: pipeline.id,
        stageId: stage.id,
        accountId: dto.accountId,
        ownerUserId: user.id,
        name: dto.name,
        amount: Number(dto.amount ?? 0),
        currency: dto.currency ?? 'TRY',
        expectedCloseDate,
        status: CrmOpportunityStatus.OPEN,
        wonAt: null,
        lostAt: null,
        lostReason: null,
      }),
    );

    const uniqTeam = Array.from(
      new Set([...(dto.teamUserIds ?? []).filter(Boolean), user.id]),
    );
    if (uniqTeam.length > 0) {
      await this.oppMemberRepo.save(
        uniqTeam.map((uid) =>
          this.oppMemberRepo.create({
            tenantId,
            opportunityId: opp.id,
            userId: uid,
          }),
        ),
      );
    }

    return opp;
  }

  async moveOpportunityStage(
    tenantId: string,
    user: CurrentUser,
    id: string,
    dto: MoveOpportunityDto,
  ) {
    const opp = await this.getOpportunityForAccessCheck(tenantId, user, id);

    const pipeline = await this.pipelineRepo.findOne({
      where: { tenantId, isDefault: true },
    });
    if (!pipeline) {
      throw new BadRequestException('Default pipeline is not initialized');
    }

    const stage = await this.stageRepo.findOne({
      where: { tenantId, id: dto.stageId, pipelineId: pipeline.id },
    });
    if (!stage) {
      throw new BadRequestException('Invalid stage');
    }

    opp.stageId = stage.id;
    if (stage.isClosedWon) {
      opp.status = CrmOpportunityStatus.WON;
      opp.wonAt = new Date();
      opp.lostAt = null;
    } else if (stage.isClosedLost) {
      opp.status = CrmOpportunityStatus.LOST;
      opp.lostAt = new Date();
      opp.wonAt = null;
    } else {
      opp.status = CrmOpportunityStatus.OPEN;
      opp.wonAt = null;
      opp.lostAt = null;
    }

    return this.oppRepo.save(opp);
  }

  async setOpportunityTeam(
    tenantId: string,
    user: CurrentUser,
    id: string,
    dto: SetOpportunityTeamDto,
  ) {
    const opp = await this.oppRepo.findOne({ where: { tenantId, id } });
    if (!opp) {
      throw new NotFoundException('Opportunity not found');
    }

    const canEdit = this.isAdmin(user) || opp.ownerUserId === user.id;
    if (!canEdit) {
      throw new ForbiddenException('Not allowed');
    }

    const uniq = Array.from(new Set([...(dto.userIds ?? []), opp.ownerUserId]));

    await this.oppMemberRepo.delete({ tenantId, opportunityId: opp.id });
    if (uniq.length > 0) {
      await this.oppMemberRepo.save(
        uniq.map((uid) =>
          this.oppMemberRepo.create({
            tenantId,
            opportunityId: opp.id,
            userId: uid,
          }),
        ),
      );
    }

    return { opportunityId: opp.id, userIds: uniq };
  }

  private async getOpportunityForAccessCheck(
    tenantId: string,
    user: CurrentUser,
    id: string,
  ): Promise<CrmOpportunity> {
    if (this.isAdmin(user)) {
      const opp = await this.oppRepo.findOne({ where: { tenantId, id } });
      if (!opp) throw new NotFoundException('Opportunity not found');
      return opp;
    }

    const opp = await this.oppRepo
      .createQueryBuilder('opp')
      .leftJoin(
        CrmOpportunityMember,
        'm',
        'm.opportunityId = opp.id AND m.tenantId = opp.tenantId',
      )
      .where('opp.tenantId = :tenantId', { tenantId })
      .andWhere('opp.id = :id', { id })
      .andWhere('(opp.ownerUserId = :userId OR m.userId = :userId)', {
        userId: user.id,
      })
      .getOne();

    if (!opp) {
      throw new NotFoundException('Opportunity not found');
    }
    return opp;
  }

  async getBoard(tenantId: string, user: CurrentUser) {
    const pipeline = await this.pipelineRepo.findOne({
      where: { tenantId, isDefault: true },
    });
    if (!pipeline) {
      return { pipeline: null, stages: [], opportunities: [] };
    }

    const stages = await this.stageRepo.find({
      where: { tenantId, pipelineId: pipeline.id },
      order: { order: 'ASC' },
    });

    let opportunities: CrmOpportunity[] = [];

    if (this.isAdmin(user)) {
      opportunities = await this.oppRepo.find({
        where: { tenantId, pipelineId: pipeline.id },
        order: { updatedAt: 'DESC' },
      });
    } else {
      const memberRows = await this.oppMemberRepo.find({
        where: { tenantId, userId: user.id },
        select: { opportunityId: true },
      });
      const memberOppIds = memberRows.map((r) => r.opportunityId);

      opportunities = await this.oppRepo.find({
        where: [
          { tenantId, pipelineId: pipeline.id, ownerUserId: user.id },
          ...(memberOppIds.length
            ? [{ tenantId, pipelineId: pipeline.id, id: In(memberOppIds) }]
            : []),
        ],
        order: { updatedAt: 'DESC' },
      });
    }

    const members = await this.oppMemberRepo.find({
      where: {
        tenantId,
        opportunityId: opportunities.length
          ? In(opportunities.map((o) => o.id))
          : In(['00000000-0000-0000-0000-000000000000']),
      },
    });

    return {
      pipeline: { id: pipeline.id, name: pipeline.name },
      stages: stages.map((s) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        isClosedWon: s.isClosedWon,
        isClosedLost: s.isClosedLost,
      })),
      opportunities: opportunities.map((o) => ({
        id: o.id,
        name: o.name,
        amount: o.amount,
        currency: o.currency,
        stageId: o.stageId,
        accountId: o.accountId,
        ownerUserId: o.ownerUserId,
        expectedCloseDate: o.expectedCloseDate,
        status: o.status,
        teamUserIds: members
          .filter((m) => m.opportunityId === o.id)
          .map((m) => m.userId),
      })),
    };
  }
}
