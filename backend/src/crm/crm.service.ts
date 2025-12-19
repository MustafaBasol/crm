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
import { OrganizationMember } from '../organizations/entities/organization-member.entity';
import { Role as OrganizationRole } from '../common/enums/organization.enum';
import { Quote } from '../quotes/entities/quote.entity';
import { Sale } from '../sales/entities/sale.entity';
import { Invoice } from '../invoices/entities/invoice.entity';

const DEFAULT_PIPELINE_NAME = 'Default Pipeline';
type DefaultStageSeed = {
  name: string;
  order: number;
  isClosedWon?: boolean;
  isClosedLost?: boolean;
};

const DEFAULT_STAGES = [
  { name: 'Lead', order: 10 },
  { name: 'Qualified', order: 20 },
  { name: 'Proposal', order: 30 },
  { name: 'Negotiation', order: 40 },
  { name: 'Won', order: 90, isClosedWon: true },
  { name: 'Lost', order: 100, isClosedLost: true },
] satisfies ReadonlyArray<DefaultStageSeed>;

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

    @InjectRepository(OrganizationMember)
    private readonly organizationMemberRepo: Repository<OrganizationMember>,

    @InjectRepository(Quote)
    private readonly quoteRepo: Repository<Quote>,

    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,

    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  private async isCurrentOrgAdminOrOwner(user: CurrentUser): Promise<boolean> {
    const orgId = user?.currentOrgId;
    if (!orgId) return false;

    const row = await this.organizationMemberRepo.findOne({
      where: {
        organizationId: orgId,
        userId: user.id,
        role: In([OrganizationRole.ADMIN, OrganizationRole.OWNER]),
      },
      select: { id: true },
    });

    return Boolean(row?.id);
  }

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

  private normalizePagination(opts?: { limit?: number; offset?: number }): {
    limit: number;
    offset: number;
  } {
    const rawLimit = Number(opts?.limit ?? 25);
    const rawOffset = Number(opts?.offset ?? 0);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(200, Math.floor(rawLimit)))
      : 25;
    const offset = Number.isFinite(rawOffset)
      ? Math.max(0, Math.floor(rawOffset))
      : 0;
    return { limit, offset };
  }

  private normalizeCompletionFilter(status?: string): boolean | undefined {
    const s = String(status ?? '')
      .trim()
      .toLowerCase();
    if (s === 'completed') return true;
    if (s === 'open') return false;
    return undefined;
  }

  async listLeads(
    tenantId: string,
    opts?: {
      q?: string;
      sortBy?: string;
      sortDir?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const { limit, offset } = this.normalizePagination(opts);

    const sortByRaw = String(opts?.sortBy ?? '').trim();
    const sortDirRaw = String(opts?.sortDir ?? '')
      .trim()
      .toLowerCase();
    const sortDir = sortDirRaw === 'asc' ? 'ASC' : 'DESC';
    const sortBy: 'updatedAt' | 'createdAt' | 'name' =
      sortByRaw === 'createdAt'
        ? 'createdAt'
        : sortByRaw === 'name'
          ? 'name'
          : 'updatedAt';

    const qb = this.leadRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId });

    const q = String(opts?.q ?? '')
      .trim()
      .toLowerCase();
    if (q) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('LOWER(l.name) LIKE :q', { q: `%${q}%` })
            .orWhere("LOWER(COALESCE(l.email, '')) LIKE :q", { q: `%${q}%` })
            .orWhere("LOWER(COALESCE(l.phone, '')) LIKE :q", { q: `%${q}%` })
            .orWhere("LOWER(COALESCE(l.company, '')) LIKE :q", { q: `%${q}%` })
            .orWhere("LOWER(COALESCE(l.status, '')) LIKE :q", { q: `%${q}%` });
        }),
      );
    }

    if (sortBy === 'name') {
      qb.addSelect('LOWER(l.name)', 'l_name_lower');
      qb.orderBy('l_name_lower', sortDir);
      qb.addOrderBy('l.updatedAt', 'DESC');
    } else if (sortBy === 'createdAt') {
      qb.orderBy('l.createdAt', sortDir);
      qb.addOrderBy('l.updatedAt', 'DESC');
    } else {
      qb.orderBy('l.updatedAt', sortDir);
    }

    qb.skip(offset).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, limit, offset };
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
    options?: {
      accountId?: string;
      q?: string;
      sortBy?: string;
      sortDir?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const accountId = options?.accountId?.trim() || undefined;
    const { limit, offset } = this.normalizePagination(options);
    const q = String(options?.q ?? '')
      .trim()
      .toLowerCase();

    const sortByRaw = String(options?.sortBy ?? '').trim();
    const sortDirRaw = String(options?.sortDir ?? '')
      .trim()
      .toLowerCase();
    const sortDir = sortDirRaw === 'asc' ? 'ASC' : 'DESC';
    const sortBy: 'updatedAt' | 'createdAt' | 'name' =
      sortByRaw === 'createdAt'
        ? 'createdAt'
        : sortByRaw === 'name'
          ? 'name'
          : 'updatedAt';

    const applySort = (
      qb: ReturnType<Repository<CrmContact>['createQueryBuilder']>,
    ) => {
      if (sortBy === 'name') {
        qb.addSelect('LOWER(c.name)', 'c_name_lower');
        qb.orderBy('c_name_lower', sortDir);
        qb.addOrderBy('c.updatedAt', 'DESC');
        return;
      }

      if (sortBy === 'createdAt') {
        qb.orderBy('c.createdAt', sortDir);
        qb.addOrderBy('c.updatedAt', 'DESC');
        return;
      }

      qb.orderBy('c.updatedAt', sortDir);
    };

    const applySearch = (
      qb: ReturnType<Repository<CrmContact>['createQueryBuilder']>,
    ) => {
      if (!q) return;

      qb.leftJoin(
        Customer,
        'cust',
        'cust.id = c.accountId AND cust.tenantId = c.tenantId',
      );

      qb.andWhere(
        new Brackets((b) => {
          b.where('LOWER(c.name) LIKE :q', { q: `%${q}%` })
            .orWhere("LOWER(COALESCE(c.email, '')) LIKE :q", { q: `%${q}%` })
            .orWhere("LOWER(COALESCE(c.phone, '')) LIKE :q", { q: `%${q}%` })
            .orWhere("LOWER(COALESCE(c.company, '')) LIKE :q", { q: `%${q}%` })
            .orWhere("LOWER(COALESCE(cust.name, '')) LIKE :q", { q: `%${q}%` });
        }),
      );
    };

    if (this.isAdmin(user)) {
      if (accountId) {
        // still validate existence for a consistent API
        await this.canAccessAccount(tenantId, user, accountId);

        const qb = this.contactRepo
          .createQueryBuilder('c')
          .where('c.tenantId = :tenantId', { tenantId })
          .andWhere('c.accountId = :accountId', { accountId });
        applySearch(qb);
        applySort(qb);
        qb.skip(offset).take(limit);
        const [items, total] = await qb.getManyAndCount();
        return { items, total, limit, offset };
      }

      const qb = this.contactRepo
        .createQueryBuilder('c')
        .where('c.tenantId = :tenantId', { tenantId });
      applySearch(qb);
      applySort(qb);
      qb.skip(offset).take(limit);
      const [items, total] = await qb.getManyAndCount();
      return { items, total, limit, offset };
    }

    if (accountId) {
      const canViewAllForAccount = await this.canAccessAccount(
        tenantId,
        user,
        accountId,
      );

      const qb = this.contactRepo
        .createQueryBuilder('c')
        .where('c.tenantId = :tenantId', { tenantId })
        .andWhere('c.accountId = :accountId', { accountId });
      if (!canViewAllForAccount) {
        qb.andWhere('c.createdByUserId = :userId', { userId: user.id });
      }
      applySearch(qb);
      applySort(qb);
      qb.skip(offset).take(limit);
      const [items, total] = await qb.getManyAndCount();
      return { items, total, limit, offset };
    }

    const accessibleAccountIds = await this.getAccessibleAccountIdsForUser(
      tenantId,
      user,
    );

    const qb = this.contactRepo
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere(
        new Brackets((b) => {
          b.where('c.createdByUserId = :userId', { userId: user.id });
          if (accessibleAccountIds.length) {
            b.orWhere('c.accountId IN (:...accountIds)', {
              accountIds: accessibleAccountIds,
            });
          }
        }),
      );
    applySearch(qb);
    applySort(qb);
    qb.skip(offset).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, limit, offset };
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
    options?: {
      opportunityId?: string;
      accountId?: string;
      q?: string;
      sortBy?: string;
      sortDir?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const opportunityId = options?.opportunityId?.trim() || undefined;
    const accountId = options?.accountId?.trim() || undefined;
    const { limit, offset } = this.normalizePagination(options);
    const completed = this.normalizeCompletionFilter(options?.status);
    const q = String(options?.q ?? '')
      .trim()
      .toLowerCase();
    const qLike = q ? `%${q}%` : '';

    const sortByRaw = String(options?.sortBy ?? '').trim();
    const sortDirRaw = String(options?.sortDir ?? '')
      .trim()
      .toLowerCase();
    const sortDir: 'ASC' | 'DESC' = sortDirRaw === 'asc' ? 'ASC' : 'DESC';
    const sortBy: 'updatedAt' | 'createdAt' | 'title' =
      sortByRaw === 'createdAt' ||
      sortByRaw === 'title' ||
      sortByRaw === 'updatedAt'
        ? sortByRaw
        : 'updatedAt';

    const applySort = (
      qb: ReturnType<Repository<CrmTask>['createQueryBuilder']>,
    ) => {
      if (sortBy === 'title') {
        qb.orderBy('LOWER(t.title)', sortDir).addOrderBy('t.updatedAt', 'DESC');
        return;
      }
      if (sortBy === 'createdAt') {
        qb.orderBy('t.createdAt', sortDir).addOrderBy('t.updatedAt', 'DESC');
        return;
      }

      qb.orderBy('t.updatedAt', sortDir);
    };

    const applySearch = (
      qb: ReturnType<Repository<CrmTask>['createQueryBuilder']>,
    ) => {
      if (!q) return;
      qb.andWhere(
        new Brackets((b) => {
          b.where('LOWER(t.title) LIKE :q').orWhere(
            "LOWER(COALESCE(t.dueAt, '')) LIKE :q",
          );
        }),
      ).setParameter('q', qLike);
    };

    if (opportunityId && accountId) {
      throw new BadRequestException(
        'Provide either opportunityId or accountId, not both',
      );
    }

    if (opportunityId) {
      await this.getOpportunityForAccessCheck(tenantId, user, opportunityId);

      const qb = this.taskRepo
        .createQueryBuilder('t')
        .where('t.tenantId = :tenantId', { tenantId })
        .andWhere('t.opportunityId = :opportunityId', { opportunityId });
      applySearch(qb);
      if (completed != null) {
        qb.andWhere('t.completed = :completed', { completed });
      }
      applySort(qb);
      qb.skip(offset).take(limit);
      const [items, total] = await qb.getManyAndCount();
      return { items, total, limit, offset };
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

      const qb = this.taskRepo
        .createQueryBuilder('t')
        .where('t.tenantId = :tenantId', { tenantId })
        .andWhere('t.accountId = :accountId', { accountId });
      applySearch(qb);
      if (completed != null) {
        qb.andWhere('t.completed = :completed', { completed });
      }
      applySort(qb);
      qb.skip(offset).take(limit);
      const [items, total] = await qb.getManyAndCount();
      return { items, total, limit, offset };
    }

    // Global list (no filters)
    if (this.isAdmin(user)) {
      const qb = this.taskRepo
        .createQueryBuilder('t')
        .where('t.tenantId = :tenantId', { tenantId });
      applySearch(qb);
      if (completed != null) {
        qb.andWhere('t.completed = :completed', { completed });
      }
      applySort(qb);
      qb.skip(offset).take(limit);
      const [items, total] = await qb.getManyAndCount();
      return { items, total, limit, offset };
    }

    const accessibleAccountIds = await this.getAccessibleAccountIdsForUser(
      tenantId,
      user,
    );

    const qb = this.taskRepo
      .createQueryBuilder('t')
      .distinct(true)
      .where('t.tenantId = :tenantId', { tenantId })
      .leftJoin(
        CrmOpportunity,
        'opp',
        'opp.id = t.opportunityId AND opp.tenantId = t.tenantId',
      )
      .leftJoin(
        CrmOpportunityMember,
        'm',
        'm.opportunityId = opp.id AND m.tenantId = opp.tenantId',
      )
      .andWhere(
        new Brackets((q) => {
          q.where(
            't.opportunityId IS NOT NULL AND (opp.ownerUserId = :userId OR m.userId = :userId)',
            { userId: user.id },
          );

          if (accessibleAccountIds.length > 0) {
            q.orWhere('t.accountId IN (:...accountIds)', {
              accountIds: accessibleAccountIds,
            });
          }
        }),
      );

    applySearch(qb);

    applySort(qb);

    if (completed != null) {
      qb.andWhere('t.completed = :completed', { completed });
    }

    qb.skip(offset).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, limit, offset };
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
        isClosedWon: Boolean(s.isClosedWon),
        isClosedLost: Boolean(s.isClosedLost),
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
      createdAt: opp.createdAt.toISOString(),
      updatedAt: opp.updatedAt.toISOString(),
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
    const opp = await this.getOpportunityForMoveStageCheck(tenantId, user, id);

    // Stage changes are destructive state transitions.
    // Policy:
    // - allow tenant admins
    // - allow opportunity owner
    // - allow organization ADMIN/OWNER (currentOrgId) *if they already have access* (team/owner)
    const canMoveStage =
      this.isAdmin(user) ||
      opp.ownerUserId === user.id ||
      (await this.isCurrentOrgAdminOrOwner(user));
    if (!canMoveStage) {
      throw new ForbiddenException(
        'You do not have permission to move this opportunity',
      );
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

  private async getOpportunityForMoveStageCheck(
    tenantId: string,
    user: CurrentUser,
    id: string,
  ): Promise<CrmOpportunity> {
    if (this.isAdmin(user)) {
      const opp = await this.oppRepo.findOne({ where: { tenantId, id } });
      if (!opp) throw new NotFoundException('Opportunity not found');
      return opp;
    }

    // Org ADMIN/OWNER can move any opportunity in the current tenant,
    // even if they are not explicitly on the opportunity team.
    if (await this.isCurrentOrgAdminOrOwner(user)) {
      const opp = await this.oppRepo.findOne({ where: { tenantId, id } });
      if (!opp) throw new NotFoundException('Opportunity not found');
      return opp;
    }

    // Default visibility: owner or opportunity team members
    return this.getOpportunityForAccessCheck(tenantId, user, id);
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
      createdAt: safeOpp.createdAt.toISOString(),
      updatedAt: safeOpp.updatedAt.toISOString(),
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
      createdAt: saved.createdAt.toISOString(),
      updatedAt: saved.updatedAt.toISOString(),
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
    options?: {
      opportunityId?: string;
      accountId?: string;
      contactId?: string;
      q?: string;
      sortBy?: string;
      sortDir?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const opportunityId = options?.opportunityId?.trim() || undefined;
    const accountId = options?.accountId?.trim() || undefined;
    const contactId = options?.contactId?.trim() || undefined;
    const { limit, offset } = this.normalizePagination(options);
    const completed = this.normalizeCompletionFilter(options?.status);
    const q = String(options?.q ?? '')
      .trim()
      .toLowerCase();
    const qLike = q ? `%${q}%` : '';

    const sortByRaw = String(options?.sortBy ?? '').trim();
    const sortDirRaw = String(options?.sortDir ?? '')
      .trim()
      .toLowerCase();
    const sortDir: 'ASC' | 'DESC' = sortDirRaw === 'asc' ? 'ASC' : 'DESC';
    const sortBy: 'updatedAt' | 'createdAt' | 'title' =
      sortByRaw === 'createdAt' ||
      sortByRaw === 'title' ||
      sortByRaw === 'updatedAt'
        ? sortByRaw
        : 'updatedAt';

    const applySort = (
      qb: ReturnType<Repository<CrmActivity>['createQueryBuilder']>,
    ) => {
      if (sortBy === 'title') {
        qb.orderBy('LOWER(a.title)', sortDir).addOrderBy('a.updatedAt', 'DESC');
        return;
      }
      if (sortBy === 'createdAt') {
        qb.orderBy('a.createdAt', sortDir).addOrderBy('a.updatedAt', 'DESC');
        return;
      }

      qb.orderBy('a.updatedAt', sortDir);
    };

    const applySearch = (
      qb: ReturnType<Repository<CrmActivity>['createQueryBuilder']>,
    ) => {
      if (!q) return;
      qb.andWhere(
        new Brackets((b) => {
          b.where('LOWER(a.title) LIKE :q')
            .orWhere("LOWER(COALESCE(a.type, '')) LIKE :q")
            .orWhere("LOWER(COALESCE(a.dueAt, '')) LIKE :q");
        }),
      ).setParameter('q', qLike);
    };

    const filterCount = [opportunityId, accountId, contactId].filter(
      Boolean,
    ).length;
    if (filterCount > 1) {
      throw new BadRequestException(
        'Provide only one of opportunityId, accountId, contactId',
      );
    }

    if (opportunityId) {
      await this.getOpportunityForAccessCheck(tenantId, user, opportunityId);

      const qb = this.activityRepo
        .createQueryBuilder('a')
        .where('a.tenantId = :tenantId', { tenantId })
        .andWhere('a.opportunityId = :opportunityId', { opportunityId });
      applySearch(qb);
      if (completed != null) {
        qb.andWhere('a.completed = :completed', { completed });
      }
      applySort(qb);
      qb.skip(offset).take(limit);
      const [items, total] = await qb.getManyAndCount();
      return { items, total, limit, offset };
    }

    if (accountId) {
      const canViewAllForAccount = await this.canAccessAccount(
        tenantId,
        user,
        accountId,
      );

      const qb = this.activityRepo
        .createQueryBuilder('a')
        .where('a.tenantId = :tenantId', { tenantId })
        .andWhere('a.accountId = :accountId', { accountId });
      if (!canViewAllForAccount) {
        qb.andWhere('a.createdByUserId = :userId', { userId: user.id });
      }
      applySearch(qb);
      if (completed != null) {
        qb.andWhere('a.completed = :completed', { completed });
      }
      applySort(qb);
      qb.skip(offset).take(limit);
      const [items, total] = await qb.getManyAndCount();
      return { items, total, limit, offset };
    }

    if (contactId) {
      const contact = await this.contactRepo.findOne({
        where: { tenantId, id: contactId },
      });
      if (!contact) throw new NotFoundException('Contact not found');

      if (this.isAdmin(user)) {
        const qb = this.activityRepo
          .createQueryBuilder('a')
          .where('a.tenantId = :tenantId', { tenantId })
          .andWhere('a.contactId = :contactId', { contactId });
        applySearch(qb);
        if (completed != null) {
          qb.andWhere('a.completed = :completed', { completed });
        }
        applySort(qb);
        qb.skip(offset).take(limit);
        const [items, total] = await qb.getManyAndCount();
        return { items, total, limit, offset };
      }

      if (contact.accountId) {
        const canViewAllForAccount = await this.canAccessAccount(
          tenantId,
          user,
          contact.accountId,
        );

        const qb = this.activityRepo
          .createQueryBuilder('a')
          .where('a.tenantId = :tenantId', { tenantId })
          .andWhere('a.contactId = :contactId', { contactId });
        if (!canViewAllForAccount) {
          qb.andWhere('a.createdByUserId = :userId', { userId: user.id });
        }
        applySearch(qb);
        if (completed != null) {
          qb.andWhere('a.completed = :completed', { completed });
        }
        applySort(qb);
        qb.skip(offset).take(limit);
        const [items, total] = await qb.getManyAndCount();
        return { items, total, limit, offset };
      }

      {
        const qb = this.activityRepo
          .createQueryBuilder('a')
          .where('a.tenantId = :tenantId', { tenantId })
          .andWhere('a.contactId = :contactId', { contactId })
          .andWhere('a.createdByUserId = :userId', { userId: user.id });
        applySearch(qb);
        if (completed != null) {
          qb.andWhere('a.completed = :completed', { completed });
        }
        applySort(qb);
        qb.skip(offset).take(limit);
        const [items, total] = await qb.getManyAndCount();
        return { items, total, limit, offset };
      }
    }

    if (this.isAdmin(user)) {
      const qb = this.activityRepo
        .createQueryBuilder('a')
        .where('a.tenantId = :tenantId', { tenantId });
      applySearch(qb);
      if (completed != null) {
        qb.andWhere('a.completed = :completed', { completed });
      }
      applySort(qb);
      qb.skip(offset).take(limit);
      const [items, total] = await qb.getManyAndCount();
      return { items, total, limit, offset };
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
      );

    applySearch(qb);

    applySort(qb);

    if (completed != null) {
      qb.andWhere('a.completed = :completed', { completed });
    }

    qb.skip(offset).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, limit, offset };
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

  async listStages(tenantId: string) {
    const pipeline = await this.pipelineRepo.findOne({
      where: { tenantId, isDefault: true },
    });
    if (!pipeline) return [];

    const stages = await this.stageRepo.find({
      where: { tenantId, pipelineId: pipeline.id },
      order: { order: 'ASC' },
    });

    return stages.map((s) => ({
      id: s.id,
      name: s.name,
      order: s.order,
      isClosedWon: s.isClosedWon,
      isClosedLost: s.isClosedLost,
    }));
  }

  async getBoard(tenantId: string, user: CurrentUser) {
    const pipeline = await this.pipelineRepo.findOne({
      where: { tenantId, isDefault: true },
    });
    if (!pipeline) {
      return { pipeline: null, stages: [], opportunities: [] };
    }

    const stages = await this.listStages(tenantId);

    const opportunities: Awaited<
      ReturnType<typeof this.listOpportunities>
    >['items'] = [];
    let offset = 0;

    // Board endpoint returns the full set (legacy behavior). We page internally
    // using the same visibility-scoped query as listOpportunities.
    // listOpportunities clamps limit to max 200.
    for (;;) {
      const page = await this.listOpportunities(tenantId, user, {
        limit: 200,
        offset,
      });

      opportunities.push(...page.items);

      if (!page.items.length) break;
      offset += page.items.length;
      if (offset >= page.total) break;
    }

    return {
      pipeline: { id: pipeline.id, name: pipeline.name },
      stages,
      opportunities,
    };
  }

  async listOpportunities(
    tenantId: string,
    user: CurrentUser,
    opts?: {
      q?: string;
      stageId?: string;
      accountId?: string;
      status?: CrmOpportunityStatus;
      sortBy?: string;
      sortDir?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const pipeline = await this.pipelineRepo.findOne({
      where: { tenantId, isDefault: true },
    });
    if (!pipeline) {
      return { items: [], total: 0, limit: 0, offset: 0 };
    }

    const rawLimit = Number(opts?.limit ?? 50);
    const rawOffset = Number(opts?.offset ?? 0);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(200, Math.floor(rawLimit)))
      : 50;
    const offset = Number.isFinite(rawOffset)
      ? Math.max(0, Math.floor(rawOffset))
      : 0;

    const sortByRaw = String(opts?.sortBy ?? '').trim();
    const sortDirRaw = String(opts?.sortDir ?? '')
      .trim()
      .toLowerCase();
    const sortDir: 'ASC' | 'DESC' = sortDirRaw === 'asc' ? 'ASC' : 'DESC';
    const sortBy: 'updatedAt' | 'createdAt' | 'name' =
      sortByRaw === 'createdAt' ||
      sortByRaw === 'name' ||
      sortByRaw === 'updatedAt'
        ? sortByRaw
        : 'updatedAt';

    const qb = this.oppRepo
      .createQueryBuilder('o')
      .where('o.tenantId = :tenantId', { tenantId })
      .andWhere('o.pipelineId = :pipelineId', { pipelineId: pipeline.id });

    const applySort = (
      qb: ReturnType<Repository<CrmOpportunity>['createQueryBuilder']>,
    ) => {
      if (sortBy === 'name') {
        qb.addSelect('LOWER(o.name)', 'o_name_lower');
        qb.orderBy('o_name_lower', sortDir);
        qb.addOrderBy('o.updatedAt', 'DESC');
        return;
      }

      if (sortBy === 'createdAt') {
        qb.orderBy('o.createdAt', sortDir);
        qb.addOrderBy('o.updatedAt', 'DESC');
        return;
      }

      qb.orderBy('o.updatedAt', sortDir);
    };

    if (!this.isAdmin(user)) {
      const memberRows = await this.oppMemberRepo.find({
        where: { tenantId, userId: user.id },
        select: { opportunityId: true },
      });
      const memberOppIds = memberRows.map((r) => r.opportunityId);

      qb.andWhere(
        new Brackets((inner) => {
          inner.where('o.ownerUserId = :userId', { userId: user.id });
          if (memberOppIds.length) {
            inner.orWhere('o.id IN (:...memberOppIds)', { memberOppIds });
          }
        }),
      );
    }

    if (opts?.stageId) {
      qb.andWhere('o.stageId = :stageId', { stageId: opts.stageId });
    }
    if (opts?.accountId) {
      qb.andWhere('o.accountId = :accountId', { accountId: opts.accountId });
    }
    if (opts?.status) {
      qb.andWhere('o.status = :status', { status: opts.status });
    }
    if (opts?.q) {
      const q = String(opts.q).trim();
      if (q) {
        qb.andWhere('LOWER(o.name) LIKE :q', { q: `%${q.toLowerCase()}%` });
      }
    }

    applySort(qb);
    qb.skip(offset).take(limit);

    const [opportunities, total] = await qb.getManyAndCount();

    const members = await this.oppMemberRepo.find({
      where: {
        tenantId,
        opportunityId: opportunities.length
          ? In(opportunities.map((o) => o.id))
          : In(['00000000-0000-0000-0000-000000000000']),
      },
      select: { opportunityId: true, userId: true },
    });

    return {
      items: opportunities.map((o) => ({
        id: o.id,
        name: o.name,
        amount: o.amount,
        currency: o.currency,
        stageId: o.stageId,
        accountId: o.accountId,
        ownerUserId: o.ownerUserId,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
        expectedCloseDate: this.toExpectedCloseDateString(o.expectedCloseDate),
        status: o.status,
        teamUserIds: members
          .filter((m) => m.opportunityId === o.id)
          .map((m) => m.userId),
      })),
      total,
      limit,
      offset,
    };
  }

  async getOpportunity(tenantId: string, user: CurrentUser, id: string) {
    const opp = await this.getOpportunityForAccessCheck(tenantId, user, id);

    const members = await this.oppMemberRepo.find({
      where: { tenantId, opportunityId: opp.id },
      select: { userId: true },
    });

    return {
      id: opp.id,
      name: opp.name,
      amount: opp.amount,
      currency: opp.currency,
      stageId: opp.stageId,
      accountId: opp.accountId,
      ownerUserId: opp.ownerUserId,
      createdAt: opp.createdAt.toISOString(),
      updatedAt: opp.updatedAt.toISOString(),
      expectedCloseDate: this.toExpectedCloseDateString(opp.expectedCloseDate),
      status: opp.status,
      teamUserIds: members.map((m) => m.userId),
    };
  }

  async listOpportunitySales(
    tenantId: string,
    user: CurrentUser,
    opportunityId: string,
  ): Promise<
    Array<
      Sale & {
        sourceQuoteNumber?: string | null;
        sourceOpportunityId?: string | null;
      }
    >
  > {
    await this.getOpportunityForAccessCheck(tenantId, user, opportunityId);

    const quoteRows = await this.quoteRepo.find({
      where: { tenantId, opportunityId },
      select: { id: true },
    });

    const quoteIds = quoteRows
      .map((q) => (q?.id ? String(q.id) : ''))
      .filter(Boolean);

    if (quoteIds.length === 0) {
      return [];
    }

    const [sales, quoteNumbers] = await Promise.all([
      this.saleRepo.find({
        where: {
          tenantId,
          sourceQuoteId: In(quoteIds),
        },
        order: { createdAt: 'DESC' },
      }),
      this.quoteRepo.find({
        where: { tenantId, id: In(quoteIds) },
        select: { id: true, quoteNumber: true, opportunityId: true },
      }),
    ]);

    const byId = new Map<string, string | null>();
    const oppById = new Map<string, string | null>();
    for (const q of quoteNumbers) {
      byId.set(String(q.id), q.quoteNumber ? String(q.quoteNumber) : null);
      oppById.set(
        String(q.id),
        q.opportunityId ? String(q.opportunityId) : null,
      );
    }

    return sales.map((s) => {
      const enriched = s as Sale & {
        sourceQuoteNumber?: string | null;
        sourceOpportunityId?: string | null;
      };
      enriched.sourceQuoteNumber = s.sourceQuoteId
        ? (byId.get(String(s.sourceQuoteId)) ?? null)
        : null;
      enriched.sourceOpportunityId = s.sourceQuoteId
        ? (oppById.get(String(s.sourceQuoteId)) ?? null)
        : null;
      return enriched;
    });
  }

  async listOpportunityInvoices(
    tenantId: string,
    user: CurrentUser,
    opportunityId: string,
  ): Promise<
    Array<
      Invoice & {
        sourceQuoteNumber?: string | null;
        sourceOpportunityId?: string | null;
      }
    >
  > {
    await this.getOpportunityForAccessCheck(tenantId, user, opportunityId);

    const quoteRows = await this.quoteRepo.find({
      where: { tenantId, opportunityId },
      select: { id: true },
    });

    const quoteIds = quoteRows
      .map((q) => (q?.id ? String(q.id) : ''))
      .filter(Boolean);

    if (quoteIds.length === 0) {
      return [];
    }

    const [invoices, quoteNumbers] = await Promise.all([
      this.invoiceRepo.find({
        where: {
          tenantId,
          isVoided: false,
          sourceQuoteId: In(quoteIds),
        },
        relations: ['customer', 'createdByUser', 'updatedByUser'],
        order: { createdAt: 'DESC' },
      }),
      this.quoteRepo.find({
        where: { tenantId, id: In(quoteIds) },
        select: { id: true, quoteNumber: true, opportunityId: true },
      }),
    ]);

    const byId = new Map<string, string | null>();
    const oppById = new Map<string, string | null>();
    for (const q of quoteNumbers) {
      byId.set(String(q.id), q.quoteNumber ? String(q.quoteNumber) : null);
      oppById.set(
        String(q.id),
        q.opportunityId ? String(q.opportunityId) : null,
      );
    }

    return invoices.map((inv) => {
      const enriched = inv as Invoice & {
        sourceQuoteNumber?: string | null;
        sourceOpportunityId?: string | null;
      };
      enriched.sourceQuoteNumber = inv.sourceQuoteId
        ? (byId.get(String(inv.sourceQuoteId)) ?? null)
        : null;
      enriched.sourceOpportunityId = inv.sourceQuoteId
        ? (oppById.get(String(inv.sourceQuoteId)) ?? null)
        : null;
      return enriched;
    });
  }
}
