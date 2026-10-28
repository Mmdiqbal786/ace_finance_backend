import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  NotificationDocument,
  NotificationType,
} from './notification.schema';
import { UsersService } from '../users/users.service';
import { StoreModelsService } from '../common/store/store-models.service';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  expenseId?: string;
  project?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly store: StoreModelsService,
    private readonly usersService: UsersService,
  ) {}

  private get notificationModel() {
    return this.store.notifications();
  }

  /** Fire-and-forget create — never blocks expense workflow. */
  enqueue(input: CreateNotificationInput | CreateNotificationInput[]) {
    const items = Array.isArray(input) ? input : [input];
    if (items.length === 0) return;
    void this.createMany(items).catch((err: any) => {
      this.logger.error(
        `Failed to create notification(s): ${err?.message || err}`,
      );
    });
  }

  async createMany(items: CreateNotificationInput[]): Promise<number> {
    if (!items.length) return 0;
    const docs = items
      .filter((i) => i.userId && i.title && i.message)
      .map((i) => ({
        userId: i.userId,
        type: i.type,
        title: i.title,
        message: i.message,
        expenseId: i.expenseId,
        project: i.project,
        isRead: false,
      }));
    if (!docs.length) return 0;
    const result = await this.notificationModel.insertMany(docs, {
      ordered: false,
    });
    return result.length;
  }

  /**
   * Create for requester only if email matches an active user account.
   */
  async enqueueForRequesterEmail(
    email: string,
    payload: Omit<CreateNotificationInput, 'userId'>,
  ) {
    const user = await this.usersService.findByEmail(email);
    if (!user || user.isActive === false) return;
    this.enqueue({
      ...payload,
      userId: user._id.toString(),
    });
  }

  async listForUser(
    userId: string,
    limit = 30,
  ): Promise<
    Array<{
      id: string;
      type: NotificationType;
      title: string;
      message: string;
      expenseId?: string;
      project?: string;
      isRead: boolean;
      createdAt: string;
    }>
  > {
    const rows = await this.notificationModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 100))
      .lean()
      .exec();

    return rows.map((n: any) => ({
      id: n._id.toString(),
      type: n.type,
      title: n.title,
      message: n.message,
      expenseId: n.expenseId,
      project: n.project,
      isRead: Boolean(n.isRead),
      createdAt: n.createdAt
        ? new Date(n.createdAt).toISOString()
        : new Date().toISOString(),
    }));
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notificationModel
      .countDocuments({ userId, isRead: false })
      .exec();
  }

  async markRead(userId: string, notificationId: string) {
    const updated = await this.notificationModel
      .findOneAndUpdate(
        { _id: notificationId, userId },
        { $set: { isRead: true, readAt: new Date() } },
        { new: true },
      )
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Notification not found');
    return {
      id: updated._id.toString(),
      isRead: true,
    };
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationModel
      .updateMany(
        { userId, isRead: false },
        { $set: { isRead: true, readAt: new Date() } },
      )
      .exec();
    return { updated: result.modifiedCount || 0 };
  }
}
