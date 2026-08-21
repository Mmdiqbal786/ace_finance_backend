import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationDocument = Notification & Document;

export type NotificationType =
  | 'EXPENSE_SUBMITTED'
  | 'EXPENSE_PENDING_APPROVAL'
  | 'EXPENSE_APPROVED'
  | 'EXPENSE_REJECTED_APPROVER'
  | 'EXPENSE_CHANGES_REQUESTED'
  | 'EXPENSE_RETURNED_APPROVER'
  | 'EXPENSE_REJECTED_PROCESSOR'
  | 'EXPENSE_FULLY_PAID'
  | 'EXPENSE_DUE_SOON';

@Schema({ collection: 'notifications', timestamps: true })
export class Notification {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({
    required: true,
    enum: [
      'EXPENSE_SUBMITTED',
      'EXPENSE_PENDING_APPROVAL',
      'EXPENSE_APPROVED',
      'EXPENSE_REJECTED_APPROVER',
      'EXPENSE_CHANGES_REQUESTED',
      'EXPENSE_RETURNED_APPROVER',
      'EXPENSE_REJECTED_PROCESSOR',
      'EXPENSE_FULLY_PAID',
      'EXPENSE_DUE_SOON',
    ],
  })
  type: NotificationType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop()
  expenseId?: string;

  @Prop()
  project?: string;

  @Prop({ default: false, index: true })
  isRead: boolean;

  @Prop()
  readAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });
