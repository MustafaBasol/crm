import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';

export type CreateNotificationInput = {
  tenantId: string;
  userId: string;
  title: string;
  description: string;
  type?: NotificationType | null;
  link?: string | null;
  relatedId?: string | null;
  i18nTitleKey?: string | null;
  i18nDescKey?: string | null;
  i18nParams?: Record<string, unknown> | null;
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  async listForUser(params: {
    tenantId: string;
    userId: string;
    unreadOnly?: boolean;
    limit: number;
    offset: number;
  }) {
    const { tenantId, userId, unreadOnly, limit, offset } = params;

    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .where('n.tenantId = :tenantId', { tenantId })
      .andWhere('n.userId = :userId', { userId });

    if (unreadOnly) {
      qb.andWhere('n.readAt IS NULL');
    }

    qb.orderBy('n.createdAt', 'DESC').skip(offset).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, limit, offset };
  }

  async unreadCount(params: { tenantId: string; userId: string }) {
    const { tenantId, userId } = params;
    const count = await this.notificationRepo.count({
      where: { tenantId, userId, readAt: IsNull() },
    });
    return { unread: count };
  }

  async markRead(params: { tenantId: string; userId: string; id: string }) {
    const { tenantId, userId, id } = params;
    await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: () => 'now()' })
      .where('id = :id', { id })
      .andWhere('tenantId = :tenantId', { tenantId })
      .andWhere('userId = :userId', { userId })
      .andWhere('readAt IS NULL')
      .execute();

    return { success: true };
  }

  async markAllRead(params: { tenantId: string; userId: string }) {
    const { tenantId, userId } = params;
    const result = await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: () => 'now()' })
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('userId = :userId', { userId })
      .andWhere('readAt IS NULL')
      .execute();

    return { success: true, updated: result.affected ?? 0 };
  }

  async createOne(input: CreateNotificationInput) {
    const entity = this.notificationRepo.create({
      tenantId: input.tenantId,
      userId: input.userId,
      title: input.title,
      description: input.description,
      type: input.type ?? null,
      link: input.link ?? null,
      relatedId: input.relatedId ?? null,
      i18nTitleKey: input.i18nTitleKey ?? null,
      i18nDescKey: input.i18nDescKey ?? null,
      i18nParams: input.i18nParams ?? null,
      readAt: null,
    });

    return this.notificationRepo.save(entity);
  }

  async createForUsers(params: {
    tenantId: string;
    userIds: string[];
    payload: Omit<CreateNotificationInput, 'tenantId' | 'userId'>;
  }) {
    const uniq = Array.from(new Set((params.userIds || []).filter(Boolean)));
    if (uniq.length === 0) return { created: 0 };

    const entities = uniq.map((userId) =>
      this.notificationRepo.create({
        tenantId: params.tenantId,
        userId,
        title: params.payload.title,
        description: params.payload.description,
        type: params.payload.type ?? null,
        link: params.payload.link ?? null,
        relatedId: params.payload.relatedId ?? null,
        i18nTitleKey: params.payload.i18nTitleKey ?? null,
        i18nDescKey: params.payload.i18nDescKey ?? null,
        i18nParams: params.payload.i18nParams ?? null,
        readAt: null,
      }),
    );

    await this.notificationRepo.save(entities);
    return { created: entities.length };
  }
}
