import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../common/decorators/user.decorator';
import type { CurrentUser } from '../common/decorators/user.decorator';
import { NotificationsService } from './notifications.service';

const clampInt = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
};

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List current user notifications' })
  async list(
    @User() user: CurrentUser,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const unread = unreadOnly === '1' || unreadOnly === 'true';
    const safeLimit = clampInt(limit, 25, 1, 100);
    const safeOffset = clampInt(offset, 0, 0, 100000);

    return this.notifications.listForUser({
      tenantId: user.tenantId,
      userId: user.id,
      unreadOnly: unread,
      limit: safeLimit,
      offset: safeOffset,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notifications count' })
  async unreadCount(@User() user: CurrentUser) {
    return this.notifications.unreadCount({
      tenantId: user.tenantId,
      userId: user.id,
    });
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(@User() user: CurrentUser, @Param('id') id: string) {
    return this.notifications.markRead({
      tenantId: user.tenantId,
      userId: user.id,
      id,
    });
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@User() user: CurrentUser) {
    return this.notifications.markAllRead({
      tenantId: user.tenantId,
      userId: user.id,
    });
  }
}
