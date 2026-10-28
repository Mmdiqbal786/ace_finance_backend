import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UserDocument, UserRole } from './user.schema';
import { MailService } from '../mail/mail.service';
import { ProjectsService } from '../projects/projects.service';
import { DEMO_SCOPED_USERS } from './demo-users.seed';
import { StoreModelsService } from '../common/store/store-models.service';
import { currentDemo, withDemoScope } from '../common/store/demo-scope';

const DEMO_ACCESS_ROLE_ORDER: UserRole[] = [
  'REQUESTER',
  'APPROVER',
  'PROCESSOR',
  'ADMIN',
];

function roleNeedsProjects(role: UserRole): boolean {
  return role === 'REQUESTER' || role === 'APPROVER';
}

const LEGACY_PROCESSOR_EMAIL = 'priya.processor@acefinance.com';
const LEGACY_PROCESSOR_NAME = 'Priya Sharma';
const NEW_PROCESSOR_EMAIL = 'alisha.processor@acefinance.com';
const NEW_PROCESSOR_NAME = 'Alisha';

function rewriteProcessorLabel(value?: string | null): string | undefined {
  if (!value) return value ?? undefined;
  let next = value;
  if (next.includes(LEGACY_PROCESSOR_NAME)) {
    next = next.split(LEGACY_PROCESSOR_NAME).join(NEW_PROCESSOR_NAME);
  }
  if (next.toLowerCase().includes(LEGACY_PROCESSOR_EMAIL)) {
    next = next.replace(
      new RegExp(LEGACY_PROCESSOR_EMAIL, 'ig'),
      NEW_PROCESSOR_EMAIL,
    );
  }
  return next;
}

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly store: StoreModelsService,
    private readonly mailService: MailService,
    private readonly projectsService: ProjectsService,
  ) {}

  private get userModel() {
    return this.store.users();
  }

  private get expenseModel() {
    return this.store.expenses();
  }

  async onModuleInit() {
    try {
      const isProd = process.env.NODE_ENV === 'production';
      // Production: skip auto-creating known-password accounts unless ALLOW_BOOT_SEED=true.
      // Use POST /auth/seed with X-Seed-Secret for controlled bootstrap instead.
      const allowBootSeed =
        !isProd || process.env.ALLOW_BOOT_SEED === 'true';

      // Live: projects always; users only when boot seed allowed
      await withDemoScope(false, async () => {
        await this.projectsService.ensureRequiredProjects();
        if (allowBootSeed) {
          await this.seedAdmin();
          await this.ensureLiveSeedUsers();
        } else {
          this.logger.log(
            'Live boot user seed skipped (production). Set ALLOW_BOOT_SEED=true or use POST /auth/seed.',
          );
        }
        await this.removeDemoPersonasFromLive();
        await this.rewriteLegacyProcessorHistory();
      });
      // Demo: admin copy + password-only demo personas (isolated DB)
      await withDemoScope(true, async () => {
        await this.projectsService.ensureRequiredProjects();
        if (allowBootSeed) {
          await this.seedAdmin();
          await this.ensureDemoScopedUsers();
        } else {
          this.logger.log(
            'Demo boot user seed skipped (production). Set ALLOW_BOOT_SEED=true or use POST /auth/seed.',
          );
        }
        await this.rewriteLegacyProcessorHistory();
      });
    } catch (err: any) {
      this.logger.warn(`Store user seed skipped: ${err?.message || err}`);
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

  /**
   * Public Demo Access list — active isDemo personas in the current store
   * (always called inside withDemoScope(true)).
   */
  async listDemoAccessAccounts(): Promise<
    Array<{
      id: string;
      name: string;
      email: string;
      role: UserRole;
      assignedProjects: string[];
    }>
  > {
    const rows = await this.userModel
      .find(
        { isDemo: true, isActive: true },
        {
          name: 1,
          email: 1,
          role: 1,
          assignedProjects: 1,
        },
      )
      .lean()
      .exec();

    const rank = (role: UserRole) => {
      const i = DEMO_ACCESS_ROLE_ORDER.indexOf(role);
      return i < 0 ? 99 : i;
    };

    return rows
      .map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.role as UserRole,
        assignedProjects: Array.isArray(u.assignedProjects)
          ? u.assignedProjects
          : [],
      }))
      .sort(
        (a, b) =>
          rank(a.role) - rank(b.role) ||
          a.name.localeCompare(b.name) ||
          a.email.localeCompare(b.email),
      );
  }

  async findByMicrosoftId(microsoftId: string): Promise<UserDocument | null> {
    if (!microsoftId) return null;
    return this.userModel.findOne({ microsoftId }).exec();
  }

  /** Accepts exact domains, or `*aceolution*` / `aceolution.*` for every Aceolution TLD. */
  private emailMatchesAllowedDomains(email: string, domains: string[]): boolean {
    const normalized = email.trim().toLowerCase();
    const at = normalized.lastIndexOf('@');
    if (at < 0) return false;
    const host = normalized.slice(at + 1);
    return domains.some((domain) => {
      if (domain === '*aceolution*' || domain === 'aceolution.*') {
        return /^aceolution\.[a-z0-9.-]+$/i.test(host);
      }
      return host === domain || normalized.endsWith(`@${domain}`);
    });
  }

  /**
   * Microsoft SSO (ACE Outsource pattern):
   * - Existing user by microsoftId or email → link + sign in (role from Ace Finance DB)
   * - New user → auto-create REQUESTER (projects empty until admin assigns)
   * - Domain allow-list applies to new users only
   * - No welcome email (they already signed in with Microsoft)
   */
  async findOrCreateFromMicrosoft(
    profile: {
      microsoftId: string;
      email: string;
      name: string;
    },
    options?: { allowedEmailDomains?: string[]; allowedEmailDomain?: string },
  ): Promise<UserDocument> {
    const email = profile.email.trim().toLowerCase();
    const existing =
      (await this.findByMicrosoftId(profile.microsoftId)) ||
      (await this.findByEmail(email));

    if (existing) {
      if (!existing.isActive) {
        throw new UnauthorizedException(
          'Your Aceolution Finance account is inactive. Ask an admin to activate it.',
        );
      }
      if (existing.microsoftId !== profile.microsoftId) {
        existing.microsoftId = profile.microsoftId;
      }
      if (profile.name?.trim() && !existing.name?.trim()) {
        existing.name = profile.name.trim();
      }
      await existing.save();
      return existing;
    }

    const domains = (
      options?.allowedEmailDomains?.length
        ? options.allowedEmailDomains
        : options?.allowedEmailDomain
          ? [options.allowedEmailDomain]
          : []
    )
      .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean);
    if (domains.length > 0 && !this.emailMatchesAllowedDomains(email, domains)) {
      throw new BadRequestException(
        'Only Aceolution Microsoft accounts (@aceolution.com, @aceolution.tw, and other @aceolution.* domains) can sign in to Aceolution Finance.',
      );
    }

    const randomPassword = crypto.randomBytes(32).toString('hex');
    const hashed = await bcrypt.hash(randomPassword, 10);
    const created = new this.userModel({
      name: (profile.name || email).trim(),
      email,
      password: hashed,
      role: 'REQUESTER' as UserRole,
      mustChangePassword: false,
      assignedProjects: [],
      microsoftId: profile.microsoftId,
      isDemo: false,
      totpEnabled: false,
    });
    return created.save();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findActiveByRole(role: UserRole): Promise<
    Array<{
      id: string;
      name: string;
      email: string;
      role: UserRole;
      assignedProjects: string[];
    }>
  > {
    const users = await this.userModel
      .find(
        { role, isActive: true },
        { name: 1, email: 1, role: 1, assignedProjects: 1 },
      )
      .lean()
      .exec();
    return users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      assignedProjects: Array.isArray(u.assignedProjects)
        ? u.assignedProjects
        : [],
    }));
  }

  /** Approvers assigned to a given project name (for workflow emails / in-app alerts). */
  async findActiveApproversForProject(
    projectName: string,
  ): Promise<Array<{ id: string; name: string; email: string }>> {
    const project = (projectName || '').trim();
    const approvers = await this.findActiveByRole('APPROVER');
    return approvers
      .filter((a) => a.assignedProjects.includes(project))
      .map((a) => ({ id: a.id, name: a.name, email: a.email }));
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
    const assigned = Array.isArray(user.assignedProjects)
      ? user.assignedProjects
      : [];
    return assigned.includes((projectName || '').trim());
  }

  async getProfile(userId: string): Promise<{
    id: string;
    name: string;
    email: string;
    role: UserRole;
    assignedProjects: string[];
    isDemo: boolean;
    microsoftLinked: boolean;
    mustSetupTotp: boolean;
  }> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const microsoftLinked = Boolean(user.microsoftId);
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      assignedProjects: Array.isArray(user.assignedProjects)
        ? user.assignedProjects
        : [],
      isDemo: Boolean(user.isDemo),
      microsoftLinked,
      mustSetupTotp:
        user.role !== 'ADMIN' &&
        !user.isDemo &&
        !microsoftLinked &&
        !(user.totpEnabled && user.totpSecret),
    };
  }

  async updateOwnProfile(
    userId: string,
    name: string,
  ): Promise<{
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
      assignedProjects: Array.isArray(user.assignedProjects)
        ? user.assignedProjects
        : [],
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
    isDemo?: boolean;
  }): Promise<any> {
    const existing = await this.findByEmail(data.email);
    if (existing) {
      throw new ConflictException(
        `User with email ${data.email} already exists`,
      );
    }

    const isDemo = Boolean(data.isDemo);
    if (isDemo && !currentDemo()) {
      throw new BadRequestException(
        'Demo Access personas can only be created in the demo workspace.',
      );
    }
    if (isDemo && data.role === 'ADMIN') {
      throw new BadRequestException(
        'Admin accounts cannot be Demo Access personas. Use Live/Demo workspace choice for admin.',
      );
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
      mustChangePassword: !isDemo,
      assignedProjects,
      isDemo,
      totpEnabled: false,
    });
    const saved = await user.save();
    const { password: _, ...result } = saved.toObject();

    if (isDemo) {
      return {
        ...result,
        welcomeEmailSent: false,
        temporaryPassword: undefined,
      };
    }

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
      isDemo?: boolean;
    },
  ): Promise<any> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundException(`User ${id} not found`);

    const nextRole = data.role ?? existing.role;
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, string> = {};
    if (data.name !== undefined) $set.name = data.name;
    if (data.role !== undefined) $set.role = data.role;
    if (data.isActive !== undefined) $set.isActive = data.isActive;

    if (data.isDemo !== undefined) {
      const nextDemo = Boolean(data.isDemo);
      if (nextDemo && !currentDemo()) {
        throw new BadRequestException(
          'Demo Access personas can only be managed in the demo workspace.',
        );
      }
      if (nextDemo && nextRole === 'ADMIN') {
        throw new BadRequestException(
          'Admin accounts cannot be Demo Access personas.',
        );
      }
      $set.isDemo = nextDemo;
      if (nextDemo) {
        $set.mustChangePassword = false;
        $set.totpEnabled = false;
        $unset.totpSecret = '';
        $unset.totpPendingSecret = '';
      }
    }

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

    const updateDoc: Record<string, unknown> = { $set };
    if (Object.keys($unset).length > 0) updateDoc.$unset = $unset;

    const user = await this.userModel
      .findByIdAndUpdate(id, updateDoc, {
        new: true,
        projection: { password: 0 },
      })
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
    const $set: { password: string; mustChangePassword?: boolean } = {
      password: hashed,
    };
    if (opts?.requireChangeOnNextLogin) {
      $set.mustChangePassword = true;
    } else if (opts?.requireChangeOnNextLogin === false) {
      $set.mustChangePassword = false;
    }
    await this.userModel.findByIdAndUpdate(id, { $set }).exec();
  }

  async clearMustChangePassword(id: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, { $set: { mustChangePassword: false } })
      .exec();
  }

  private hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async createPasswordResetToken(
    email: string,
  ): Promise<{ token: string; name: string } | null> {
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

  async resetPasswordWithToken(
    userId: string,
    newPassword: string,
  ): Promise<void> {
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.userModel.findByIdAndUpdate(userId, {
      $set: { password: hashed, mustChangePassword: false },
      $unset: { passwordResetToken: '', passwordResetExpires: '' },
    });
  }

  private hashOtp(code: string): string {
    return crypto.createHash('sha256').update(code.trim()).digest('hex');
  }

  async setLoginOtp(
    userId: string,
    code: string,
    ttlMs = 10 * 60 * 1000,
  ): Promise<void> {
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
    if (result.deletedCount === 0)
      throw new NotFoundException(`User ${id} not found`);
  }

  async countAll(): Promise<number> {
    return this.userModel.countDocuments().exec();
  }

  /**
   * Ensure an ADMIN exists in the current store (used when Microsoft/password
   * admin opens Demo and the email is not seeded there yet).
   */
  async ensureAdminMirror(
    email: string,
    name: string,
  ): Promise<UserDocument> {
    const normalized = email.trim().toLowerCase();
    const existing = await this.findByEmail(normalized);
    if (existing) {
      if (!existing.isActive || existing.role !== 'ADMIN') {
        existing.isActive = true;
        existing.role = 'ADMIN';
        existing.mustChangePassword = false;
        existing.isDemo = false;
        await existing.save();
      }
      return existing;
    }
    const hashed = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    return this.userModel.create({
      name: (name || normalized).trim(),
      email: normalized,
      password: hashed,
      role: 'ADMIN',
      mustChangePassword: false,
      assignedProjects: [],
      isDemo: false,
      totpEnabled: false,
    });
  }

  async seedAdmin(): Promise<{ created: boolean; message: string }> {
    const email = 'finance@aceolution.com';
    const existing = await this.findByEmail(email);
    if (existing) {
      if (existing.role !== 'ADMIN' || existing.isActive === false) {
        existing.role = 'ADMIN';
        existing.isActive = true;
        existing.mustChangePassword = false;
        await existing.save();
        return {
          created: false,
          message: `Admin ensured (${currentDemo() ? 'demo' : 'live'}): ${email}`,
        };
      }
      return {
        created: false,
        message: `Admin already exists (${currentDemo() ? 'demo' : 'live'}).`,
      };
    }
    const hashed = await bcrypt.hash('Admin@1234', 10);
    await this.userModel.create({
      name: 'Admin',
      email,
      password: hashed,
      role: 'ADMIN',
      mustChangePassword: false,
      assignedProjects: [],
      isDemo: false,
    });
    return {
      created: true,
      message: `Admin account created (${currentDemo() ? 'demo' : 'live'}): ${email} / Admin@1234`,
    };
  }

  /** Live DB only: upsert primary OTP test accounts (not isDemo personas). */
  async ensureLiveSeedUsers(): Promise<{
    created: number;
    updated: number;
    message: string;
  }> {
    return this.upsertSeedUsers(
      DEMO_SCOPED_USERS.filter((u) => !u.isDemo),
      false,
    );
  }

  /**
   * Demo DB only: upsert password-only demo personas (isDemo).
   * Does not send welcome emails. Updates assignedProjects on every boot.
   */
  async ensureDemoScopedUsers(): Promise<{
    created: number;
    updated: number;
    message: string;
  }> {
    // Rename legacy demo processor (Priya Sharma → Alisha).
    const legacyProcessor = await this.findByEmail(LEGACY_PROCESSOR_EMAIL);
    if (legacyProcessor) {
      const taken = await this.findByEmail(NEW_PROCESSOR_EMAIL);
      if (!taken || String(taken._id) === String(legacyProcessor._id)) {
        legacyProcessor.name = NEW_PROCESSOR_NAME;
        legacyProcessor.email = NEW_PROCESSOR_EMAIL;
        await legacyProcessor.save();
        this.logger.log(
          `Migrated demo processor ${LEGACY_PROCESSOR_EMAIL} → ${NEW_PROCESSOR_EMAIL} (${NEW_PROCESSOR_NAME})`,
        );
      }
    }

    return this.upsertSeedUsers(
      DEMO_SCOPED_USERS.filter((u) => Boolean(u.isDemo)),
      true,
    );
  }

  /** Remove leftover isDemo personas from the live database. */
  async removeDemoPersonasFromLive(): Promise<number> {
    if (currentDemo()) return 0;
    const result = await this.userModel.deleteMany({ isDemo: true }).exec();
    const n = result.deletedCount || 0;
    if (n > 0) {
      this.logger.log(`Removed ${n} demo persona(s) from live database`);
    }
    return n;
  }

  private async upsertSeedUsers(
    seeds: typeof DEMO_SCOPED_USERS,
    forceDemoFlag: boolean,
  ): Promise<{ created: number; updated: number; message: string }> {
    let created = 0;
    let updated = 0;

    for (const demo of seeds) {
      const email = demo.email.toLowerCase();
      const assignedProjects = await this.assertAssignedProjectsValid(
        demo.role,
        demo.assignedProjects,
      );
      const isDemo = forceDemoFlag || Boolean(demo.isDemo);
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

    const label = forceDemoFlag ? 'Demo personas' : 'Live seed users';
    return {
      created,
      updated,
      message: `${label}: ${created} created, ${updated} updated.`,
    };
  }

  /**
   * Expense audit rows store "Name (email)" snapshots. Rewrite legacy
   * Priya Sharma / priya.processor@… labels after the demo user rename.
   */
  private async rewriteLegacyProcessorHistory(): Promise<void> {
    const filter = {
      $or: [
        { 'history.user': new RegExp(LEGACY_PROCESSOR_EMAIL, 'i') },
        { 'history.user': LEGACY_PROCESSOR_NAME },
        { changeRequestedBy: new RegExp(LEGACY_PROCESSOR_EMAIL, 'i') },
        { changeRequestedBy: LEGACY_PROCESSOR_NAME },
        {
          'paymentReceipts.uploadedBy': new RegExp(LEGACY_PROCESSOR_EMAIL, 'i'),
        },
        { 'paymentReceipts.uploadedBy': LEGACY_PROCESSOR_NAME },
      ],
    };

    const expenses = await this.expenseModel.find(filter).exec();
    let updated = 0;

    for (const expense of expenses) {
      let dirty = false;

      if (Array.isArray(expense.history)) {
        for (const entry of expense.history) {
          const next = rewriteProcessorLabel(entry.user);
          if (next && next !== entry.user) {
            entry.user = next;
            dirty = true;
          }
        }
      }

      const nextChangeBy = rewriteProcessorLabel(expense.changeRequestedBy);
      if (
        nextChangeBy !== undefined &&
        nextChangeBy !== expense.changeRequestedBy
      ) {
        expense.changeRequestedBy = nextChangeBy;
        dirty = true;
      }

      if (Array.isArray((expense as any).paymentReceipts)) {
        for (const receipt of (expense as any).paymentReceipts) {
          const nextUploadedBy = rewriteProcessorLabel(receipt.uploadedBy);
          if (
            nextUploadedBy !== undefined &&
            nextUploadedBy !== receipt.uploadedBy
          ) {
            receipt.uploadedBy = nextUploadedBy;
            dirty = true;
          }
        }
      }

      if (dirty) {
        expense.markModified('history');
        expense.markModified('paymentReceipts');
        await expense.save();
        updated += 1;
      }
    }

    // In-app notifications may also contain the old name/email in message text.
    try {
      const notifications = this.expenseModel.db.collection('notifications');
      const notifResult = await notifications.updateMany(
        {
          $or: [
            { message: new RegExp(LEGACY_PROCESSOR_EMAIL, 'i') },
            { message: LEGACY_PROCESSOR_NAME },
            { title: new RegExp(LEGACY_PROCESSOR_EMAIL, 'i') },
            { title: LEGACY_PROCESSOR_NAME },
          ],
        },
        [
          {
            $set: {
              message: {
                $replaceAll: {
                  input: {
                    $replaceAll: {
                      input: { $ifNull: ['$message', ''] },
                      find: LEGACY_PROCESSOR_NAME,
                      replacement: NEW_PROCESSOR_NAME,
                    },
                  },
                  find: LEGACY_PROCESSOR_EMAIL,
                  replacement: NEW_PROCESSOR_EMAIL,
                },
              },
              title: {
                $replaceAll: {
                  input: {
                    $replaceAll: {
                      input: { $ifNull: ['$title', ''] },
                      find: LEGACY_PROCESSOR_NAME,
                      replacement: NEW_PROCESSOR_NAME,
                    },
                  },
                  find: LEGACY_PROCESSOR_EMAIL,
                  replacement: NEW_PROCESSOR_EMAIL,
                },
              },
            },
          },
        ],
      );
      if (notifResult.modifiedCount) {
        this.logger.log(
          `Rewrote legacy processor labels in ${notifResult.modifiedCount} notification(s)`,
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `Notification label rewrite skipped: ${err?.message || err}`,
      );
    }

    if (updated) {
      this.logger.log(
        `Rewrote legacy processor labels in ${updated} expense audit trail(s)`,
      );
    }
  }
}
