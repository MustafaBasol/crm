import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { CrmPipeline } from './entities/crm-pipeline.entity';
import { CrmStage } from './entities/crm-stage.entity';
import {
  CrmOpportunity,
  CrmOpportunityStatus,
} from './entities/crm-opportunity.entity';
import { CrmOpportunityMember } from './entities/crm-opportunity-member.entity';
import { CrmActivity } from './entities/crm-activity.entity';
import { CrmTask } from './entities/crm-task.entity';
import { CrmLead } from './entities/crm-lead.entity';
import { CrmContact } from './entities/crm-contact.entity';
import { Customer } from '../customers/entities/customer.entity';
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

    @InjectRepository(CrmActivity)
    private readonly activityRepo: Repository<CrmActivity>,

    @InjectRepository(CrmTask)
    private readonly taskRepo: Repository<CrmTask>,

    @InjectRepository(CrmLead)
    private readonly leadRepo: Repository<CrmLead>,

    @InjectRepository(CrmContact)
    private readonly contactRepo: Repository<CrmContact>,

    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  private async canAccessAccount(
    tenantId: string,
    user: CurrentUser,
    accountId: string,
  ): Promise<boolean> {
    const customer = await this.customerRepo.findOne({
      where: { tenantId, id: accountId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    if (this.isAdmin(user)) return true;

    // Non-admin visibility:
    // A user can access an account iff they are either the owner OR a team member
    // of at least one opportunity linked to that account.
    // NOTE: There may be multiple opportunities per account; do not rely on an arbitrary one.
    const ownedOpp = await this.oppRepo.findOne({
      where: { tenantId, accountId, ownerUserId: user.id },
      select: { id: true },
    });
    if (ownedOpp) return true;

    const memberRow = await this.oppMemberRepo
      .createQueryBuilder('m')
      .innerJoin(
        CrmOpportunity,
        'opp',
        'opp.id = m.opportunityId AND opp.tenantId = m.tenantId',
      )
      .select('m.id', 'id')
      .where('m.tenantId = :tenantId', { tenantId })
      .andWhere('m.userId = :userId', { userId: user.id })
      .andWhere('opp.accountId = :accountId', { accountId })
      .limit(1)
      .getRawOne<{ id: string }>();

    return Boolean(memberRow?.id);
  }

  private async assertAccountAccessible(
    tenantId: string,
    user: CurrentUser,
    accountId: string,
  ) {
    const ok = await this.canAccessAccount(tenantId, user, accountId);
    if (!ok) throw new ForbiddenException('Not allowed');
  }

  private async getAccessibleAccountIdsForUser(
    tenantId: string,
    user: CurrentUser,
  ): Promise<string[]> {
    if (this.isAdmin(user)) return [];

    const rows = await this.oppRepo
      .createQueryBuilder('opp')
      .leftJoin(
        CrmOpportunityMember,
        'm',
        'm.opportunityId = opp.id AND m.tenantId = opp.tenantId',
      )
      .select('DISTINCT opp.accountId', 'accountId')
      .where('opp.tenantId = :tenantId', { tenantId })
      .andWhere('opp.accountId IS NOT NULL')
      .andWhere('(opp.ownerUserId = :userId OR m.userId = :userId)', {
        userId: user.id,
      })
      .getRawMany<{ accountId: string }>();

    return rows
      .map((r) => r.accountId)
      .filter((id): id is string => Boolean(id));
  }

  async listLeads(tenantId: string) {
    return this.leadRepo.find({
      where: { tenantId },
      order: { updatedAt: 'DESC' },
    });
  }

  async createLead(tenantId: string, user: CurrentUser, dto: CreateLeadDto) {
    const name = String(dto.name ?? '').trim();
    if (!name) throw new BadRequestException('Name is required');

    const entity = this.leadRepo.create({
      tenantId,
      name,
      email: dto.email ? String(dto.email).trim() : null,
      phone: dto.phone ? String(dto.phone).trim() : null,
      company: dto.company ? String(dto.company).trim() : null,
      status: dto.status ? String(dto.status).trim() : null,
      createdByUserId: user.id,
      updatedByUserId: null,
    });

    return this.leadRepo.save(entity);
  }

  async updateLead(
    tenantId: string,
    user: CurrentUser,
    id: string,
    dto: UpdateLeadDto,
  ) {
    const lead = await this.leadRepo.findOne({ where: { tenantId, id } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (!this.isAdmin(user) && lead.createdByUserId !== user.id) {
      throw new ForbiddenException('Not allowed');
    }

    if ('name' in dto) {
      const name = String(dto.name ?? '').trim();
      if (!name) throw new BadRequestException('Name is required');
      lead.name = name;
    }
    if ('email' in dto)
      lead.email = dto.email ? String(dto.email).trim() : null;
    if ('phone' in dto)
      lead.phone = dto.phone ? String(dto.phone).trim() : null;
    if ('company' in dto)
      lead.company = dto.company ? String(dto.company).trim() : null;
    if ('status' in dto)
      lead.status = dto.status ? String(dto.status).trim() : null;

    lead.updatedByUserId = user.id;
    return this.leadRepo.save(lead);
  }

  async deleteLead(tenantId: string, user: CurrentUser, id: string) {
    const lead = await this.leadRepo.findOne({ where: { tenantId, id } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (!this.isAdmin(user) && lead.createdByUserId !== user.id) {
      throw new ForbiddenException('Not allowed');
    }
    await this.leadRepo.delete({ tenantId, id });
    return { ok: true };
  }

  async listContacts(
    tenantId: string,
    user: CurrentUser,
    options?: { accountId?: string },
  ) {
    const accountId = options?.accountId?.trim() || undefined;

    if (this.isAdmin(user)) {
      if (accountId) {
        // still validate existence for a consistent API
        await this.canAccessAccount(tenantId, user, accountId);
        return this.contactRepo.find({
          where: { tenantId, accountId },
          order: { updatedAt: 'DESC' },
        });
      }

      return this.contactRepo.find({
        where: { tenantId },
        order: { updatedAt: 'DESC' },
      });
    }

    if (accountId) {
      const canViewAllForAccount = await this.canAccessAccount(
        tenantId,
        user,
        accountId,
      );

      return this.contactRepo.find({
        where: canViewAllForAccount
          ? { tenantId, accountId }
          : { tenantId, accountId, createdByUserId: user.id },
        order: { updatedAt: 'DESC' },
      });
    }

    const accessibleAccountIds = await this.getAccessibleAccountIdsForUser(
      tenantId,
      user,
    );

    return this.contactRepo.find({
      where: [
        { tenantId, createdByUserId: user.id },
        ...(accessibleAccountIds.length
          ? [{ tenantId, accountId: In(accessibleAccountIds) }]
          : []),
      ],
      order: { updatedAt: 'DESC' },
    });
  }

  async createContact(
    tenantId: string,
    user: CurrentUser,
    dto: CreateContactDto,
  ) {
    const name = String(dto.name ?? '').trim();
    if (!name) throw new BadRequestException('Name is required');

    const accountId = dto.accountId ? String(dto.accountId).trim() : '';
    if (accountId) {
      const customer = await this.customerRepo.findOne({
        where: { tenantId, id: accountId },
      });
      if (!customer) throw new NotFoundException('Customer not found');

      if (!this.isAdmin(user)) {
        await this.assertAccountAccessible(tenantId, user, accountId);
      }
    }

    const entity = this.contactRepo.create({
      tenantId,
      name,
      email: dto.email ? String(dto.email).trim() : null,
      phone: dto.phone ? String(dto.phone).trim() : null,
      company: dto.company ? String(dto.company).trim() : null,
      accountId: accountId || null,
      createdByUserId: user.id,
      updatedByUserId: null,
    });

    return this.contactRepo.save(entity);
  }

  async updateContact(
    tenantId: string,
    user: CurrentUser,
    id: string,
    dto: UpdateContactDto,
  ) {
    const contact = await this.contactRepo.findOne({ where: { tenantId, id } });
    if (!contact) throw new NotFoundException('Contact not found');
    if (!this.isAdmin(user) && contact.createdByUserId !== user.id) {
      throw new ForbiddenException('Not allowed');
    }

    if ('name' in dto) {
      const name = String(dto.name ?? '').trim();
      if (!name) throw new BadRequestException('Name is required');
      contact.name = name;
    }
    if ('email' in dto)
      contact.email = dto.email ? String(dto.email).trim() : null;
    if ('phone' in dto)
      contact.phone = dto.phone ? String(dto.phone).trim() : null;
    if ('company' in dto)
      contact.company = dto.company ? String(dto.company).trim() : null;

    if ('accountId' in dto) {
      const nextAccountId = dto.accountId ? String(dto.accountId).trim() : '';
      if (nextAccountId) {
        const customer = await this.customerRepo.findOne({
          where: { tenantId, id: nextAccountId },
        });
        if (!customer) throw new NotFoundException('Customer not found');

        if (!this.isAdmin(user)) {
          await this.assertAccountAccessible(tenantId, user, nextAccountId);
        }
        contact.accountId = nextAccountId;
      } else {
        contact.accountId = null;
      }
    }

    contact.updatedByUserId = user.id;
    return this.contactRepo.save(contact);
  }

  async deleteContact(tenantId: string, user: CurrentUser, id: string) {
    const contact = await this.contactRepo.findOne({ where: { tenantId, id } });
    if (!contact) throw new NotFoundException('Contact not found');
    if (!this.isAdmin(user) && contact.createdByUserId !== user.id) {
      throw new ForbiddenException('Not allowed');
    }
    await this.contactRepo.delete({ tenantId, id });
    return { ok: true };
  }

  async listTasks(
    tenantId: string,
    user: CurrentUser,
    options?: { opportunityId?: string; accountId?: string },
  ) {
    const opportunityId = options?.opportunityId?.trim() || undefined;
    const accountId = options?.accountId?.trim() || undefined;

    if (opportunityId && accountId) {
      throw new BadRequestException(
        'Provide either opportunityId or accountId, not both',
      );
    }

    if (opportunityId) {
      await this.getOpportunityForAccessCheck(tenantId, user, opportunityId);
      return this.taskRepo.find({
        where: { tenantId, opportunityId },
        order: { updatedAt: 'DESC' },
      });
    }

    if (accountId) {
      const customer = await this.customerRepo.findOne({
        where: { tenantId, id: accountId },
      });
      if (!customer) throw new NotFoundException('Customer not found');

      if (!this.isAdmin(user)) {
        const visibleOpp = await this.oppRepo
          .createQueryBuilder('opp')
          .leftJoin(
            CrmOpportunityMember,
            'm',
            'm.opportunityId = opp.id AND m.tenantId = opp.tenantId',
          )
          .where('opp.tenantId = :tenantId', { tenantId })
          .andWhere('opp.accountId = :accountId', { accountId })
          .andWhere('(opp.ownerUserId = :userId OR m.userId = :userId)', {
            userId: user.id,
          })
          .getOne();

        if (!visibleOpp) {
          throw new ForbiddenException('Not allowed');
        }
      }

      return this.taskRepo.find({
        where: { tenantId, accountId },
        order: { updatedAt: 'DESC' },
      });
    }

    throw new BadRequestException('Provide opportunityId or accountId');
  }

  async createTask(tenantId: string, user: CurrentUser, dto: CreateTaskDto) {
    const title = String(dto.title ?? '').trim();
    if (!title) throw new BadRequestException('Title is required');

    const opportunityId = dto.opportunityId
      ? String(dto.opportunityId).trim()
      : '';
    const accountId = dto.accountId ? String(dto.accountId).trim() : '';

    if (opportunityId && accountId) {
      throw new BadRequestException(
        'Provide either opportunityId or accountId, not both',
      );
    }
    if (!opportunityId && !accountId) {
      throw new BadRequestException('Provide opportunityId or accountId');
    }

    if (opportunityId) {
      await this.getOpportunityForAccessCheck(tenantId, user, opportunityId);
    }

    if (accountId) {
      const customer = await this.customerRepo.findOne({
        where: { tenantId, id: accountId },
      });
      if (!customer) throw new NotFoundException('Customer not found');

      if (!this.isAdmin(user)) {
        const visibleOpp = await this.oppRepo
          .createQueryBuilder('opp')
          .leftJoin(
            CrmOpportunityMember,
            'm',
            'm.opportunityId = opp.id AND m.tenantId = opp.tenantId',
          )
          .where('opp.tenantId = :tenantId', { tenantId })
          .andWhere('opp.accountId = :accountId', { accountId })
          .andWhere('(opp.ownerUserId = :userId OR m.userId = :userId)', {
            userId: user.id,
          })
          .getOne();

        if (!visibleOpp) {
          throw new ForbiddenException('Not allowed');
        }
      }
    }

    const entity = this.taskRepo.create({
      tenantId,
      title,
      opportunityId: opportunityId || null,
      accountId: accountId || null,
      dueAt: dto.dueAt ?? null,
      completed: Boolean(dto.completed),
      assigneeUserId: dto.assigneeUserId ?? null,
      createdByUserId: user.id,
      updatedByUserId: null,
    });

    return this.taskRepo.save(entity);
  }

  async updateTask(
    tenantId: string,
    user: CurrentUser,
    id: string,
    dto: UpdateTaskDto,
  ) {
    const task = await this.taskRepo.findOne({ where: { tenantId, id } });
    if (!task) throw new NotFoundException('Task not found');

    const canEditUnlinked =
      this.isAdmin(user) || task.createdByUserId === user.id;

    if (task.opportunityId) {
      await this.getOpportunityForAccessCheck(
        tenantId,
        user,
        task.opportunityId,
      );
    }

    if (task.accountId) {
      const customer = await this.customerRepo.findOne({
        where: { tenantId, id: task.accountId },
      });
      if (!customer) throw new NotFoundException('Customer not found');
      if (!this.isAdmin(user)) {
        const visibleOpp = await this.oppRepo
          .createQueryBuilder('opp')
          .leftJoin(
            CrmOpportunityMember,
            'm',
            'm.opportunityId = opp.id AND m.tenantId = opp.tenantId',
          )
          .where('opp.tenantId = :tenantId', { tenantId })
          .andWhere('opp.accountId = :accountId', { accountId: task.accountId })
          .andWhere('(opp.ownerUserId = :userId OR m.userId = :userId)', {
            userId: user.id,
          })
          .getOne();
        if (!visibleOpp && !canEditUnlinked) {
          throw new ForbiddenException('Not allowed');
        }
      }
    }

    if ('title' in dto) {
      const nextTitle = String(dto.title ?? '').trim();
      if (!nextTitle) throw new BadRequestException('Title is required');
      task.title = nextTitle;
    }
    if ('dueAt' in dto) {
      task.dueAt = dto.dueAt ?? null;
    }
    if ('completed' in dto) {
      task.completed = Boolean(dto.completed);
    }
    if ('assigneeUserId' in dto) {
      task.assigneeUserId = dto.assigneeUserId ?? null;
    }

    task.updatedByUserId = user.id;
    return this.taskRepo.save(task);
  }

  async deleteTask(tenantId: string, user: CurrentUser, id: string) {
    const task = await this.taskRepo.findOne({ where: { tenantId, id } });
    if (!task) throw new NotFoundException('Task not found');

    const canDeleteUnlinked =
      this.isAdmin(user) || task.createdByUserId === user.id;

    if (task.opportunityId) {
      await this.getOpportunityForAccessCheck(
        tenantId,
        user,
        task.opportunityId,
      );
    }

    if (task.accountId) {
      const customer = await this.customerRepo.findOne({
        where: { tenantId, id: task.accountId },
      });
      if (!customer) throw new NotFoundException('Customer not found');
      if (!this.isAdmin(user)) {
        const visibleOpp = await this.oppRepo
          .createQueryBuilder('opp')
          .leftJoin(
            CrmOpportunityMember,
            'm',
            'm.opportunityId = opp.id AND m.tenantId = opp.tenantId',
          )
          .where('opp.tenantId = :tenantId', { tenantId })
          .andWhere('opp.accountId = :accountId', { accountId: task.accountId })
          .andWhere('(opp.ownerUserId = :userId OR m.userId = :userId)', {
            userId: user.id,
          })
          .getOne();
        if (!visibleOpp && !canDeleteUnlinked) {
          throw new ForbiddenException('Not allowed');
        }
      }
    }

    if (!task.opportunityId && !task.accountId && !canDeleteUnlinked) {
      throw new ForbiddenException('Not allowed');
    }

    await this.taskRepo.delete({ tenantId, id });
    return { ok: true };
  }

  private isAdmin(user: CurrentUser): boolean {
    return (
      user?.role === UserRole.SUPER_ADMIN ||
      user?.role === UserRole.TENANT_ADMIN
    );
  }

  private toExpectedCloseDateString(
    value: Date | string | null | undefined,
  ): string | null {
    if (!value) return null;
    if (value instanceof Date) {
      try {
        return value.toISOString().slice(0, 10);
      } catch {
        return null;
      }
    }
    const raw = String(value).trim();
    if (!raw) return null;
    // If already a date-only string, keep it.
    if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(raw)) return raw;
    const parsed = Date.parse(raw);
    if (!Number.isFinite(parsed)) return raw;
    return new Date(parsed).toISOString().slice(0, 10);
  }

  private async getTeamUserIdsForOpportunity(
    tenantId: string,
    opportunityId: string,
  ): Promise<string[]> {
    const members = await this.oppMemberRepo.find({
      where: { tenantId, opportunityId },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
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

  async createOpportunity(
    tenantId: string,
    user: CurrentUser,
    dto: CreateOpportunityDto,
  ) {
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

    const accountId = dto.accountId ? String(dto.accountId).trim() : '';
    if (accountId) {
      const customer = await this.customerRepo.findOne({
        where: { tenantId, id: accountId },
      });
      if (!customer) throw new NotFoundException('Customer not found');
    }

    const opp = await this.oppRepo.save(
      this.oppRepo.create({
        tenantId,
        pipelineId: pipeline.id,
        stageId: stage.id,
        accountId: accountId || null,
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

    return {
      id: opp.id,
      name: opp.name,
      amount: opp.amount,
      currency: opp.currency,
      stageId: opp.stageId,
      accountId: opp.accountId,
      ownerUserId: opp.ownerUserId,
      expectedCloseDate: this.toExpectedCloseDateString(opp.expectedCloseDate),
      status: opp.status,
      teamUserIds: uniqTeam,
    };
  }

  async moveOpportunityStage(
    tenantId: string,
    user: CurrentUser,
    id: string,
    dto: MoveOpportunityDto,
  ) {
    const opp = await this.getOpportunityForAccessCheck(tenantId, user, id);

    // Stage changes are destructive state transitions; restrict to owner/admin.
    const canMoveStage = this.isAdmin(user) || opp.ownerUserId === user.id;
    if (!canMoveStage) {
      throw new ForbiddenException('You do not have permission to move this opportunity');
    }

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

    const saved = await this.oppRepo.save(opp);
    const teamUserIds = await this.getTeamUserIdsForOpportunity(
      tenantId,
      saved.id,
    );
    return {
      id: saved.id,
      name: saved.name,
      amount: saved.amount,
      currency: saved.currency,
      stageId: saved.stageId,
      accountId: saved.accountId,
      ownerUserId: saved.ownerUserId,
      expectedCloseDate: this.toExpectedCloseDateString(
        saved.expectedCloseDate,
      ),
      status: saved.status,
      teamUserIds,
    };
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

    const refreshed = await this.oppRepo.findOne({
      where: { tenantId, id: opp.id },
    });
    const safeOpp = refreshed ?? opp;
    return {
      id: safeOpp.id,
      name: safeOpp.name,
      amount: safeOpp.amount,
      currency: safeOpp.currency,
      stageId: safeOpp.stageId,
      accountId: safeOpp.accountId,
      ownerUserId: safeOpp.ownerUserId,
      expectedCloseDate: this.toExpectedCloseDateString(
        safeOpp.expectedCloseDate,
      ),
      status: safeOpp.status,
      teamUserIds: uniq,
    };
  }

  async updateOpportunity(
    tenantId: string,
    user: CurrentUser,
    id: string,
    dto: UpdateOpportunityDto,
  ) {
    const opp = await this.oppRepo.findOne({ where: { tenantId, id } });
    if (!opp) throw new NotFoundException('Opportunity not found');

    const canEdit = this.isAdmin(user) || opp.ownerUserId === user.id;
    if (!canEdit) throw new ForbiddenException('Not allowed');

    if (dto.name != null) {
      const name = String(dto.name).trim();
      if (!name) throw new BadRequestException('Name is required');
      opp.name = name;
    }

    if (dto.accountId != null) {
      const nextAccountId = dto.accountId ? String(dto.accountId).trim() : '';
      if (nextAccountId) {
        const customer = await this.customerRepo.findOne({
          where: { tenantId, id: nextAccountId },
        });
        if (!customer) throw new NotFoundException('Customer not found');
        opp.accountId = nextAccountId;
      } else {
        opp.accountId = null;
      }
    }

    if (dto.amount != null) {
      const amount = Number(dto.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new BadRequestException('Invalid amount');
      }
      opp.amount = amount;
    }

    if (dto.currency != null) {
      opp.currency = dto.currency;
    }

    if ('expectedCloseDate' in dto) {
      if (dto.expectedCloseDate == null) {
        opp.expectedCloseDate = null;
      } else {
        opp.expectedCloseDate = new Date(dto.expectedCloseDate);
      }
    }

    const saved = await this.oppRepo.save(opp);
    const teamUserIds = await this.getTeamUserIdsForOpportunity(
      tenantId,
      saved.id,
    );
    return {
      id: saved.id,
      name: saved.name,
      amount: saved.amount,
      currency: saved.currency,
      stageId: saved.stageId,
      accountId: saved.accountId,
      ownerUserId: saved.ownerUserId,
      expectedCloseDate: this.toExpectedCloseDateString(
        saved.expectedCloseDate,
      ),
      status: saved.status,
      teamUserIds,
    };
  }

  async listActivities(
    tenantId: string,
    user: CurrentUser,
    options?: { opportunityId?: string; accountId?: string; contactId?: string },
  ) {
    const opportunityId = options?.opportunityId?.trim() || undefined;
    const accountId = options?.accountId?.trim() || undefined;
    const contactId = options?.contactId?.trim() || undefined;

    const filterCount = [opportunityId, accountId, contactId].filter(Boolean)
      .length;
    if (filterCount > 1) {
      throw new BadRequestException(
        'Provide only one of opportunityId, accountId, contactId',
      );
    }

    if (opportunityId) {
      await this.getOpportunityForAccessCheck(tenantId, user, opportunityId);
      return this.activityRepo.find({
        where: { tenantId, opportunityId },
        order: { updatedAt: 'DESC' },
      });
    }

    if (accountId) {
      const canViewAllForAccount = await this.canAccessAccount(
        tenantId,
        user,
        accountId,
      );

      return this.activityRepo.find({
        where: canViewAllForAccount
          ? { tenantId, accountId }
          : { tenantId, accountId, createdByUserId: user.id },
        order: { updatedAt: 'DESC' },
      });
    }

    if (contactId) {
      const contact = await this.contactRepo.findOne({
        where: { tenantId, id: contactId },
      });
      if (!contact) throw new NotFoundException('Contact not found');

      if (this.isAdmin(user)) {
        return this.activityRepo.find({
          where: { tenantId, contactId },
          order: { updatedAt: 'DESC' },
        });
      }

      if (contact.accountId) {
        const canViewAllForAccount = await this.canAccessAccount(
          tenantId,
          user,
          contact.accountId,
        );
        return this.activityRepo.find({
          where: canViewAllForAccount
            ? { tenantId, contactId }
            : { tenantId, contactId, createdByUserId: user.id },
          order: { updatedAt: 'DESC' },
        });
      }

      return this.activityRepo.find({
        where: { tenantId, contactId, createdByUserId: user.id },
        order: { updatedAt: 'DESC' },
      });
    }

    if (this.isAdmin(user)) {
      return this.activityRepo.find({
        where: { tenantId },
        order: { updatedAt: 'DESC' },
      });
    }

    const [memberRows, ownerRows] = await Promise.all([
      this.oppMemberRepo.find({
        where: { tenantId, userId: user.id },
        select: { opportunityId: true },
      }),
      this.oppRepo.find({
        where: { tenantId, ownerUserId: user.id },
        select: { id: true },
      }),
    ]);

    const accessibleOppIds = Array.from(
      new Set([
        ...memberRows.map((r) => r.opportunityId),
        ...ownerRows.map((r) => r.id),
      ]),
    );

    const qb = this.activityRepo
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere(
        new Brackets((b) => {
          b.where('a.createdByUserId = :userId AND a.opportunityId IS NULL', {
            userId: user.id,
          });
          if (accessibleOppIds.length > 0) {
            b.orWhere('a.opportunityId IN (:...oppIds)', {
              oppIds: accessibleOppIds,
            });
          }
        }),
      )
      .orderBy('a.updatedAt', 'DESC');

    return qb.getMany();
  }

  async createActivity(
    tenantId: string,
    user: CurrentUser,
    dto: CreateActivityDto,
  ) {
    const title = String(dto.title ?? '').trim();
    if (!title) throw new BadRequestException('Title is required');

    const opportunityId = dto.opportunityId ?? null;
    if (opportunityId) {
      await this.getOpportunityForAccessCheck(tenantId, user, opportunityId);
    }

    const accountId = dto.accountId ?? null;
    if (accountId) {
      const customer = await this.customerRepo.findOne({
        where: { tenantId, id: accountId },
      });
      if (!customer) throw new NotFoundException('Customer not found');
    }

    if (opportunityId && accountId) {
      throw new BadRequestException(
        'Provide either opportunityId or accountId, not both',
      );
    }

    const contactId = dto.contactId ?? null;
    if (contactId) {
      const contact = await this.contactRepo.findOne({
        where: { tenantId, id: contactId },
      });
      if (!contact) throw new NotFoundException('Contact not found');

      if (!this.isAdmin(user)) {
        if (contact.accountId) {
          const canViewAllForAccount = await this.canAccessAccount(
            tenantId,
            user,
            contact.accountId,
          );
          const canUseContact =
            canViewAllForAccount || contact.createdByUserId === user.id;
          if (!canUseContact) throw new ForbiddenException('Not allowed');
        } else {
          if (contact.createdByUserId !== user.id) {
            throw new ForbiddenException('Not allowed');
          }
        }
      }

      // If the contact is linked to an account, validate that the account exists.
      // Visibility is enforced on reads; creation is still creator-owned.
      if (contact.accountId) {
        await this.canAccessAccount(tenantId, user, contact.accountId);
      }
    }

    if ([opportunityId, accountId, contactId].filter(Boolean).length > 1) {
      throw new BadRequestException(
        'Provide only one of opportunityId, accountId, contactId',
      );
    }

    const entity = this.activityRepo.create({
      tenantId,
      title,
      type: String(dto.type ?? '').trim(),
      accountId,
      opportunityId,
      contactId,
      dueAt: dto.dueAt ?? null,
      completed: Boolean(dto.completed),
      createdByUserId: user.id,
      updatedByUserId: null,
    });

    return this.activityRepo.save(entity);
  }

  async updateActivity(
    tenantId: string,
    user: CurrentUser,
    id: string,
    dto: UpdateActivityDto,
  ) {
    const activity = await this.activityRepo.findOne({
      where: { tenantId, id },
    });
    if (!activity) throw new NotFoundException('Activity not found');

    const canEditUnlinked =
      this.isAdmin(user) || activity.createdByUserId === user.id;
    if (!activity.opportunityId && !canEditUnlinked) {
      throw new ForbiddenException('Not allowed');
    }

    if (activity.opportunityId) {
      await this.getOpportunityForAccessCheck(
        tenantId,
        user,
        activity.opportunityId,
      );
    }

    if (activity.accountId) {
      if (!this.isAdmin(user)) {
        const canViewAllForAccount = await this.canAccessAccount(
          tenantId,
          user,
          activity.accountId,
        );
        if (!canViewAllForAccount && activity.createdByUserId !== user.id) {
          throw new ForbiddenException('Not allowed');
        }
      }
    }

    if ('opportunityId' in dto) {
      const nextOppId = dto.opportunityId ?? null;
      if (nextOppId) {
        await this.getOpportunityForAccessCheck(tenantId, user, nextOppId);
      }
      activity.opportunityId = nextOppId;
    }

    if ('accountId' in dto) {
      const nextAccountId = dto.accountId ?? null;
      if (nextAccountId) {
        if (!this.isAdmin(user)) {
          const canViewAllForAccount = await this.canAccessAccount(
            tenantId,
            user,
            nextAccountId,
          );
          if (!canViewAllForAccount && activity.createdByUserId !== user.id) {
            throw new ForbiddenException('Not allowed');
          }
        }
      }
      activity.accountId = nextAccountId;
    }

    if ('contactId' in dto) {
      const nextContactId = dto.contactId ?? null;
      if (nextContactId) {
        const contact = await this.contactRepo.findOne({
          where: { tenantId, id: nextContactId },
        });
        if (!contact) throw new NotFoundException('Contact not found');

        if (!this.isAdmin(user)) {
          if (contact.accountId) {
            const canViewAllForAccount = await this.canAccessAccount(
              tenantId,
              user,
              contact.accountId,
            );
            const canUseContact =
              canViewAllForAccount || contact.createdByUserId === user.id;
            if (!canUseContact) throw new ForbiddenException('Not allowed');
          } else {
            if (contact.createdByUserId !== user.id) {
              throw new ForbiddenException('Not allowed');
            }
          }
        }
      }
      activity.contactId = nextContactId;
    }

    if (
      [activity.opportunityId, activity.accountId, activity.contactId].filter(
        Boolean,
      ).length > 1
    ) {
      throw new BadRequestException(
        'Provide only one of opportunityId, accountId, contactId',
      );
    }

    if ('title' in dto && dto.title != null) {
      const nextTitle = String(dto.title).trim();
      if (!nextTitle) throw new BadRequestException('Title is required');
      activity.title = nextTitle;
    }

    if ('type' in dto && dto.type != null) {
      activity.type = String(dto.type).trim();
    }

    if ('dueAt' in dto) {
      activity.dueAt = dto.dueAt ?? null;
    }

    if ('completed' in dto && typeof dto.completed === 'boolean') {
      activity.completed = dto.completed;
    }

    activity.updatedByUserId = user.id;
    return this.activityRepo.save(activity);
  }

  async deleteActivity(tenantId: string, user: CurrentUser, id: string) {
    const activity = await this.activityRepo.findOne({
      where: { tenantId, id },
    });
    if (!activity) throw new NotFoundException('Activity not found');

    const canEditUnlinked =
      this.isAdmin(user) || activity.createdByUserId === user.id;
    if (!activity.opportunityId && !canEditUnlinked) {
      throw new ForbiddenException('Not allowed');
    }

    if (activity.opportunityId) {
      await this.getOpportunityForAccessCheck(
        tenantId,
        user,
        activity.opportunityId,
      );
    }

    if (activity.accountId) {
      if (!this.isAdmin(user)) {
        const canViewAllForAccount = await this.canAccessAccount(
          tenantId,
          user,
          activity.accountId,
        );
        if (!canViewAllForAccount && activity.createdByUserId !== user.id) {
          throw new ForbiddenException('Not allowed');
        }
      }
    }

    await this.activityRepo.delete({ tenantId, id });
    return { ok: true };
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
        expectedCloseDate: this.toExpectedCloseDateString(o.expectedCloseDate),
        status: o.status,
        teamUserIds: members
          .filter((m) => m.opportunityId === o.id)
          .map((m) => m.userId),
      })),
    };
  }
}
