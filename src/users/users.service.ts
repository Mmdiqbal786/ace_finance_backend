import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User, UserDocument, UserRole } from './user.schema';
import { MailService } from '../mail/mail.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly mailService: MailService,
  ) {}

  async findAll(): Promise<any[]> {
    return this.userModel
      .find({}, { password: 0 })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async getProfile(userId: string): Promise<{
    id: string;
    name: string;
    email: string;
    role: UserRole;
  }> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  async updateOwnProfile(userId: string, name: string): Promise<{
    id: string;
    name: string;
    email: string;
    role: UserRole;
  }> {
    const trimmed = name?.trim();
    if (!trimmed || trimmed.length < 2) {
      throw new ConflictException('Name must be at least 2 characters.');
    }
    if (trimmed.length > 80) {
      throw new ConflictException('Name must be 80 characters or fewer.');
    }

    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: { name: trimmed } }, { new: true })
      .lean()
      .exec();
    if (!user) throw new NotFoundException('User not found');

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  private generateTemporaryPassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const all = upper + lower + digits;
    const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
    const chars = [pick(upper), pick(lower), pick(digits)];
    for (let i = 0; i < 9; i++) chars.push(pick(all));
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }

  private resolveTemporaryPassword(password?: string): string {
    if (typeof password === 'string' && password.trim().length >= 8) {
      return password.trim();
    }
    return this.generateTemporaryPassword();
  }

  async create(data: {
    name: string;
    email: string;
    role: UserRole;
    password?: string;
  }): Promise<any> {
    const existing = await this.findByEmail(data.email);
    if (existing) {
      throw new ConflictException(`User with email ${data.email} already exists`);
    }

    const temporaryPassword = this.resolveTemporaryPassword(data.password);

    const hashed = await bcrypt.hash(temporaryPassword, 10);
    const user = new this.userModel({
      name: data.name,
      email: data.email.toLowerCase(),
      password: hashed,
      role: data.role,
      mustChangePassword: true,
    });
    const saved = await user.save();
    const { password: _, ...result } = saved.toObject();

    const mailResult = await this.mailService.sendWelcomeEmail({
      to: result.email,
      name: result.name,
      email: result.email,
      temporaryPassword,
      role: result.role,
    });

    return {
      ...result,
      welcomeEmailSent: mailResult.sent,
      welcomeEmailError: mailResult.sent ? undefined : mailResult.reason,
      // Only return temp password when email failed, so admin can share it manually
      temporaryPassword: mailResult.sent ? undefined : temporaryPassword,
    };
  }

  async update(
    id: string,
    data: { name?: string; role?: UserRole; isActive?: boolean },
  ): Promise<any> {
    const user = await this.userModel
      .findByIdAndUpdate(id, { $set: data }, { new: true, projection: { password: 0 } })
      .lean()
      .exec();
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async updatePassword(
    id: string,
    newPassword: string,
    opts?: { requireChangeOnNextLogin?: boolean },
  ): Promise<void> {
    const hashed = await bcrypt.hash(newPassword, 10);
    const $set: { password: string; mustChangePassword?: boolean } = { password: hashed };
    if (opts?.requireChangeOnNextLogin) {
      $set.mustChangePassword = true;
    } else if (opts?.requireChangeOnNextLogin === false) {
      $set.mustChangePassword = false;
    }
    await this.userModel.findByIdAndUpdate(id, { $set }).exec();
  }

  async clearMustChangePassword(id: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { $set: { mustChangePassword: false } }).exec();
  }

  private hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /** Returns a plain reset token when the user exists and is active; otherwise null. */
  async createPasswordResetToken(email: string): Promise<{ token: string; name: string } | null> {
    const user = await this.findByEmail(email);
    if (!user || !user.isActive) return null;

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await this.userModel.findByIdAndUpdate(user._id, {
      $set: {
        passwordResetToken: this.hashResetToken(token),
        passwordResetExpires: expires,
      },
    });

    return { token, name: user.name };
  }

  async findByValidResetToken(token: string): Promise<UserDocument | null> {
    if (!token?.trim()) return null;
    return this.userModel
      .findOne({
        passwordResetToken: this.hashResetToken(token.trim()),
        passwordResetExpires: { $gt: new Date() },
      })
      .exec();
  }

  async resetPasswordWithToken(userId: string, newPassword: string): Promise<void> {
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.userModel.findByIdAndUpdate(userId, {
      $set: { password: hashed, mustChangePassword: false },
      $unset: { passwordResetToken: '', passwordResetExpires: '' },
    });
  }

  async delete(id: string): Promise<void> {
    const result = await this.userModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) throw new NotFoundException(`User ${id} not found`);
  }

  async countAll(): Promise<number> {
    return this.userModel.countDocuments().exec();
  }

  async seedAdmin(): Promise<{ created: boolean; message: string }> {
    const count = await this.countAll();
    if (count > 0) {
      return { created: false, message: 'Users already exist. Seed skipped.' };
    }
    const hashed = await bcrypt.hash('Admin@1234', 10);
    await this.userModel.create({
      name: 'Admin',
      email: 'admin@acefinance.com',
      password: hashed,
      role: 'ADMIN',
      mustChangePassword: false,
    });
    return {
      created: true,
      message: 'Admin account created: admin@acefinance.com / Admin@1234',
    };
  }
}
