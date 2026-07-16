import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

export type UserRole = 'ADMIN' | 'APPROVER' | 'PROCESSOR' | 'REQUESTER';

@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    required: true,
    enum: ['ADMIN', 'APPROVER', 'PROCESSOR', 'REQUESTER'],
    default: 'APPROVER',
  })
  role: UserRole;

  @Prop({ default: true })
  isActive: boolean;

  /** When true, user must set a new password before accessing the dashboard */
  @Prop({ default: false })
  mustChangePassword: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
