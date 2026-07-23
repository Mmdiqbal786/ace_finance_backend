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

  @Prop()
  passwordResetToken?: string;

  @Prop()
  passwordResetExpires?: Date;

  /** SHA-256 hash of the current email login OTP */
  @Prop()
  loginOtpHash?: string;

  @Prop()
  loginOtpExpires?: Date;

  /** Authenticator app secret (required for non-admin; optional for ADMIN) */
  @Prop()
  totpSecret?: string;

  @Prop({ default: false })
  totpEnabled?: boolean;

  /** Pending secret while user completes QR setup */
  @Prop()
  totpPendingSecret?: string;

  /**
   * Project names this Requester/Approver may use.
   * Empty for Admin/Processor. Required (non-empty) for Requester/Approver.
   */
  @Prop({ type: [String], default: [] })
  assignedProjects?: string[];

  /**
   * Seeded demo personas (@acefinance.com): password-only login —
   * skip email OTP and authenticator enrollment. Real users stay false.
   */
  @Prop({ default: false })
  isDemo?: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
