import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User, UserDocument, UserRole } from './user.schema';
import { MailService } from '../mail/mail.service';
import { ProjectsService } from '../projects/projects.service';
import { DEMO_SCOPED_USERS } from './demo-users.seed';

function roleNeedsProjects(role: UserRole): boolean {
  return role === 'REQUESTER' || role === 'APPROVER';
}

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly mailService: MailService,
    private readonly projectsService: ProjectsService,
  ) {}

  async onModuleInit() {
    try {
      await this.projectsService.ensureRequiredProjects();
      await this.ensureDemoScopedUsers();
    } catch (err: any) {
      this.logger.warn(
        `Demo user seed skipped: ${err?.message || err}`,
      );
    }
  }

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

  async findActiveByRole(
    role: UserRole,
  ): Promise<
    Array<{ name: string; email: string; role: UserRole; assignedProjects: string[] }>
  > {
    const users = await this.userModel
      .find({ role, isActive: true }, { name: 1, email: 1, role: 1, assignedProjects: 1 })
      .lean()
      .exec();
    return users.map((u) => ({
      name: u.name,
      email: u.email,
      role: u.role,
      assignedProjects: Array.isArray(u.assignedProjects) ? u.assignedProjects : [],
    }));
  }

  /** Approvers assigned to a given project name (for workflow emails). */
  async findActiveApproversForProject(
    projectName: string,
  ): Promise<Array<{ name: string; email: string }>> {
    const project = (projectName || '').trim();
    const approvers = await this.findActiveByRole('APPROVER');
    return approvers
      .filter((a) => a.assignedProjects.includes(project))
      .map((a) => ({ name: a.name, email: a.email }));
  }

  private normalizeAssignedProjects(
    role: UserRole,
    assignedProjects?: string[] | null,
  ): string[] {
    if (!roleNeedsProjects(role)) {
      return [];
    }
    const list = Array.isArray(assignedProjects)
      ? assignedProjects.map((p) => String(p || '').trim()).filter(Boolean)
      : [];
    return [...new Set(list)];
  }

  private async assertAssignedProjectsValid(
    role: UserRole,
    assignedProjects?: string[] | null,
  ): Promise<string[]> {
    const normalized = this.normalizeAssignedProjects(role, assignedProjects);
    if (!roleNeedsProjects(role)) {
      return [];
    }
    if (normalized.length === 0) {
      throw new BadRequestException(
        'Assign at least one project for Requester and Approver roles.',
      );
    }
    const active = await this.projectsService.findActive();
    const activeNames = new Set(active.map((p: { name: string }) => p.name));
    const invalid = normalized.filter((name) => !activeNames.has(name));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Invalid or inactive project(s): ${invalid.join(', ')}`,
      );
    }
    return normalized;
  }

  userHasProjectAccess(
    user: { role: string; assignedProjects?: string[] | null },
    projectName: string,
  ): boolean {
    if (user.role === 'ADMIN' || user.role === 'PROCESSOR') return true;
    if (!roleNeedsProjects(user.role as UserRole)) return true;
    const assigned = Array.isArray(user.assignedProjects) ? user.assignedProjects : [];
    return assigned.includes((projectName || '').trim());
  }

  async getProfile(userId: string): Promise<{
    id: string;
    name: string;
    email: string;
    role: UserRole;
    assignedProjects: string[];
    isDemo: boolean;
  }> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      assignedProjects: Array.isArray(user.assignedProjects) ? user.assignedProjects : [],
      isDemo: Boolean(user.isDemo),
    };
  }

  async updateOwnProfile(userId: string, name: string): Promise<{
    id: string;
    name: string;
    email: string;
    role: UserRole;
    assignedProjects: string[];
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
      assignedProjects: Array.isArray(user.assignedProjects) ? user.assignedProjects : [],
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
    assignedProjects?: string[];
  }): Promise<any> {
    const existing = await this.findByEmail(data.email);
    if (existing) {
      throw new ConflictException(`User with email ${data.email} already exists`);
    }

    const assignedProjects = await this.assertAssignedProjectsValid(
      data.role,
      data.assignedProjects,
    );

    const temporaryPassword = this.resolveTemporaryPassword(data.password);

    const hashed = await bcrypt.hash(temporaryPassword, 10);
    const user = new this.userModel({
      name: data.name,
      email: data.email.toLowerCase(),
      password: hashed,
      role: data.role,
      mustChangePassword: true,
      assignedProjects,
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
      temporaryPassword: mailResult.sent ? undefined : temporaryPassword,
    };
  }

  async update(
    id: string,
    data: {
      name?: string;
      role?: UserRole;
      isActive?: boolean;
      assignedProjects?: string[];
    },
  ): Promise<any> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundException(`User ${id} not found`);

    const nextRole = data.role ?? existing.role;
    const $set: Record<string, unknown> = {};
    if (data.name !== undefined) $set.name = data.name;
    if (data.role !== undefined) $set.role = data.role;
    if (data.isActive !== undefined) $set.isActive = data.isActive;

    if (data.role !== undefined || data.assignedProjects !== undefined) {
      const projectsSource =
        data.assignedProjects !== undefined
          ? data.assignedProjects
          : existing.assignedProjects;
      $set.assignedProjects = await this.assertAssignedProjectsValid(
        nextRole,
        projectsSource,
      );
    }

    const user = await this.userModel
      .findByIdAndUpdate(id, { $set }, { new: true, projection: { password: 0 } })
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

  private hashOtp(code: string): string {
    return crypto.createHash('sha256').update(code.trim()).digest('hex');
  }

  async setLoginOtp(userId: string, code: string, ttlMs = 10 * 60 * 1000): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $set: {
        loginOtpHash: this.hashOtp(code),
        loginOtpExpires: new Date(Date.now() + ttlMs),
      },
    });
  }

  async verifyLoginOtp(userId: string, code: string): Promise<boolean> {
    const user = await this.findById(userId);
    if (!user?.loginOtpHash || !user.loginOtpExpires) return false;
    if (user.loginOtpExpires.getTime() < Date.now()) return false;
    return user.loginOtpHash === this.hashOtp(code);
  }

  async clearLoginOtp(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $unset: { loginOtpHash: '', loginOtpExpires: '' },
    });
  }

  async setTotpPendingSecret(userId: string, secret: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $set: { totpPendingSecret: secret },
    });
  }

  async enableTotp(userId: string, secret: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $set: { totpSecret: secret, totpEnabled: true },
      $unset: { totpPendingSecret: '' },
    });
  }

  async disableTotp(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $set: { totpEnabled: false },
      $unset: { totpSecret: '', totpPendingSecret: '' },
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
      email: 'finance@aceolution.com',
      password: hashed,
      role: 'ADMIN',
      mustChangePassword: false,
      assignedProjects: [],
    });
    return {
      created: true,
      message: 'Admin account created: finance@aceolution.com / Admin@1234',
    };
  }

  /**
   * Upsert demo requesters/approvers with distinct project assignments.
   * Does not send welcome emails. Updates assignedProjects on every boot.
   */
  async ensureDemoScopedUsers(): Promise<{
    created: number;
    updated: number;
    message: string;
  }> {
    let created = 0;
    let updated = 0;

    for (const demo of DEMO_SCOPED_USERS) {
      const email = demo.email.toLowerCase();
      const assignedProjects = await this.assertAssignedProjectsValid(
        demo.role,
        demo.assignedProjects,
      );
      const isDemo = Boolean(demo.isDemo);
      const existing = await this.findByEmail(email);

      if (!existing) {
        const hashed = await bcrypt.hash(demo.password, 10);
        await this.userModel.create({
          name: demo.name,
          email,
          password: hashed,
          role: demo.role,
          isActive: true,
          mustChangePassword: false,
          assignedProjects,
          isDemo,
          // Demo personas never need authenticator enrollment.
          totpEnabled: false,
          totpSecret: undefined,
          totpPendingSecret: undefined,
        });
        created += 1;
        this.logger.log(
          `Created demo user ${email} (${demo.role}${isDemo ? ', isDemo' : ''})`,
        );
        continue;
      }

      const prev = Array.isArray(existing.assignedProjects)
        ? existing.assignedProjects
        : [];
      const sameProjects =
        prev.length === assignedProjects.length &&
        prev.every((p) => assignedProjects.includes(p));
      const sameRole = existing.role === demo.role;
      const sameName = existing.name === demo.name;
      const sameDemo = Boolean(existing.isDemo) === isDemo;

      if (
        sameProjects &&
        sameRole &&
        sameName &&
        sameDemo &&
        existing.isActive !== false &&
        !existing.mustChangePassword
      ) {
        continue;
      }

      existing.name = demo.name;
      existing.role = demo.role;
      existing.isActive = true;
      existing.mustChangePassword = false;
      existing.assignedProjects = assignedProjects;
      existing.isDemo = isDemo;
      if (isDemo) {
        existing.totpEnabled = false;
        existing.totpSecret = undefined;
        existing.totpPendingSecret = undefined;
      }
      await existing.save();
      // Clear legacy field from earlier seed naming.
      await this.userModel
        .updateOne({ _id: existing._id }, { $unset: { demoSkip2fa: 1 } })
        .exec();
      updated += 1;
      this.logger.log(`Updated demo user ${email} projects/role/isDemo`);
    }

    return {
      created,
      updated,
      message: `Demo users: ${created} created, ${updated} updated.`,
    };
  }
}
