import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { howWhy } from '../common/swagger/api-guide';
import { ApiSopResponses } from '../common/swagger/api-sop';
import { NOTIFICATION_ROW } from '../common/swagger/sop-data-samples';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Latest notifications for the signed-in user',
    description: howWhy({
      why: 'Bell dropdown.',
      how: 'GET (newest first). `expenseId` links to the request detail.',
    }),
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 30,
    description: 'Default 30',
  })
  @ApiSopResponses({ successData: [NOTIFICATION_ROW] })
  async list(@Request() req: any, @Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 30;
    return this.notificationsService.listForUser(
      req.user.userId,
      Number.isFinite(parsed) ? parsed : 30,
    );
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Unread notification count',
    description: howWhy({
      why: 'Bell badge number.',
      how: 'Poll GET → `{ count }`.',
    }),
  })
  @ApiSopResponses({ successData: { count: 3 } })
  async unreadCount(@Request() req: any) {
    const count = await this.notificationsService.unreadCount(req.user.userId);
    return { count };
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark all notifications read',
    description: howWhy({
      why: '"Mark all as read" button.',
      how: 'PATCH → `{ updated }` count.',
    }),
  })
  @ApiSopResponses({ successData: { updated: 3 } })
  async markAllRead(@Request() req: any) {
    return this.notificationsService.markAllRead(req.user.userId);
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark one notification read',
    description: howWhy({
      why: 'User opened a notification.',
      how: 'PATCH with notification `id`.',
    }),
  })
  @ApiSopResponses({
    successData: { id: NOTIFICATION_ROW.id, isRead: true },
    notFound: 'Notification not found',
  })
  async markRead(@Request() req: any, @Param('id') id: string) {
    return this.notificationsService.markRead(req.user.userId, id);
  }
}
