import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@Request() req: any, @Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 30;
    return this.notificationsService.listForUser(
      req.user.userId,
      Number.isFinite(parsed) ? parsed : 30,
    );
  }

  @Get('unread-count')
  async unreadCount(@Request() req: any) {
    const count = await this.notificationsService.unreadCount(req.user.userId);
    return { count };
  }

  @Patch('read-all')
  async markAllRead(@Request() req: any) {
    return this.notificationsService.markAllRead(req.user.userId);
  }

  @Patch(':id/read')
  async markRead(@Request() req: any, @Param('id') id: string) {
    return this.notificationsService.markRead(req.user.userId, id);
  }
}
