import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { UsersService } from '../users/users.service';
import { CategoriesService } from '../categories/categories.service';
import { CountriesService } from '../countries/countries.service';
import { MailService } from '../mail/mail.service';
import { UserDocument } from '../users/user.schema';

type TwoFactorMethod = 'email' | 'totp';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private categoriesService: CategoriesService,
    private countriesService: CountriesService,
    private mailService: MailService,
  ) {}

  async validateUser(email: string, password: string): Promise<UserDocument> {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid email or password');
    if (!user.isActive) throw new UnauthorizedException('Your account has been deactivated');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid email or password');
    return user;
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}${'*'.repeat(Math.max(local.length - visible.length, 2))}@${domain}`;
  }

  private generateEmailOtp(): string {
    return String(crypto.randomInt(100000, 1000000));
  }

  private availableMethods(user: UserDocument): TwoFactorMethod[] {
    // Admin: no email OTP. Authenticator only if they opted in.
    if (user.role === 'ADMIN') {
      return user.totpEnabled && user.totpSecret ? ['totp'] : [];
    }
    // Everyone else: email OTP always; authenticator optional extra method
    const methods: TwoFactorMethod[] = ['email'];
    if (user.totpEnabled && user.totpSecret) {
      methods.push('totp');
    }
    return methods;
  }

  /** Non-admin users must enroll authenticator before using the dashboard. */
  private mustSetupTotp(user: UserDocument): boolean {
    if (user.role === 'ADMIN') return false;
    return !(user.totpEnabled && user.totpSecret);
  }

  private issueAccessToken(user: UserDocument) {
    const mustChangePassword = Boolean(user.mustChangePassword);
    const mustSetupTotp = this.mustSetupTotp(user);
    const payload = {
      sub: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword,
      mustSetupTotp,
      totpEnabled: Boolean(user.totpEnabled && user.totpSecret),
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword,
        mustSetupTotp,
        totpEnabled: Boolean(user.totpEnabled && user.totpSecret),
      },
    };
  }

  private async issueChallenge(user: UserDocument, sendEmail = true) {
    const methods = this.availableMethods(user);
    if (methods.length === 0) {
      return this.issueAccessToken(user);
    }

    const needsEmail = methods.includes('email');

    if (sendEmail && needsEmail) {
      const code = this.generateEmailOtp();
      await this.usersService.setLoginOtp(user._id.toString(), code);

      const mailResult = await this.mailService.sendLoginOtpEmail({
        to: user.email,
        name: user.name,
        code,
      });
      if (!mailResult.sent) {
        throw new BadRequestException(
          `We could not send the verification email (${mailResult.reason || 'SMTP error'}). Check SMTP settings or contact your administrator.`,
        );
      }
    }

    const challengeToken = this.jwtService.sign(
      {
        sub: user._id.toString(),
        purpose: 'login_2fa',
        methods,
      },
      { expiresIn: '10m' },
    );

    return {
      requires2fa: true as const,
      challengeToken,
      methods,
      emailHint: this.maskEmail(user.email),
      message:
        methods.includes('totp') && methods.includes('email')
          ? 'Enter the code from your email or authenticator app.'
          : methods.includes('totp')
            ? 'Enter the 6-digit code from your authenticator app.'
            : 'Enter the 6-digit code we sent to your email.',
    };
  }

  private async resolveChallengeToken(challengeToken: string): Promise<{
    user: UserDocument;
    methods: TwoFactorMethod[];
  }> {
    if (!challengeToken?.trim()) {
      throw new UnauthorizedException('Verification session expired. Please sign in again.');
    }
    let payload: { sub?: string; purpose?: string; methods?: TwoFactorMethod[] };
    try {
      payload = this.jwtService.verify(challengeToken.trim());
    } catch {
      throw new UnauthorizedException('Verification session expired. Please sign in again.');
    }
    if (payload.purpose !== 'login_2fa' || !payload.sub) {
      throw new UnauthorizedException('Invalid verification session. Please sign in again.');
    }
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid verification session. Please sign in again.');
    }
    return {
      user,
      methods: Array.isArray(payload.methods) ? payload.methods : this.availableMethods(user),
    };
  }

  /**
   * Step 1: password check.
   * - Non-admin → email OTP challenge
   * - Admin without authenticator → signed in immediately (no 2FA)
   * - Admin with authenticator enabled → TOTP challenge only
   */
  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    const methods = this.availableMethods(user);
    if (methods.length === 0) {
      return this.issueAccessToken(user);
    }
    return this.issueChallenge(user, true);
  }

  async resendLoginOtp(challengeToken: string) {
    const { user } = await this.resolveChallengeToken(challengeToken);
    return this.issueChallenge(user, true);
  }

  async verifyLogin2fa(params: {
    challengeToken: string;
    code: string;
    method?: TwoFactorMethod;
  }) {
    const code = String(params.code || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException('Enter the 6-digit verification code.');
    }

    const { user, methods } = await this.resolveChallengeToken(params.challengeToken);
    const preferred = params.method;
    const tryOrder: TwoFactorMethod[] =
      preferred && methods.includes(preferred)
        ? [preferred]
        : methods.includes('totp')
          ? ['totp', 'email']
          : ['email'];

    let ok = false;
    let used: TwoFactorMethod | null = null;

    for (const method of tryOrder) {
      if (method === 'email') {
        ok = await this.usersService.verifyLoginOtp(user._id.toString(), code);
      } else if (method === 'totp' && user.totpEnabled && user.totpSecret) {
        const result = verifySync({ token: code, secret: user.totpSecret });
        ok = Boolean(result.valid);
      }
      if (ok) {
        used = method;
        break;
      }
    }

    if (!ok || !used) {
      throw new UnauthorizedException('Invalid or expired verification code.');
    }

    await this.usersService.clearLoginOtp(user._id.toString());
    return this.issueAccessToken(user);
  }

  async getTotpStatus(userId: string, _role: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    const enabled = Boolean(user.totpEnabled && user.totpSecret);
    return {
      available: true,
      enabled,
      pendingSetup: Boolean(user.totpPendingSecret),
      required: user.role !== 'ADMIN',
      canDisable: user.role === 'ADMIN',
      canReplace: enabled,
    };
  }

  private async buildTotpSetupPayload(user: UserDocument, secret: string) {
    const otpauthUrl = generateURI({
      issuer: 'Aceolution Finance',
      label: user.email,
      secret,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      width: 220,
      margin: 2,
    });
    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  async setupTotp(userId: string, _role: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    if (user.totpEnabled && user.totpSecret) {
      throw new BadRequestException(
        'Authenticator is already enabled. Use Change authenticator to replace it.',
      );
    }

    const secret = generateSecret();
    await this.usersService.setTotpPendingSecret(userId, secret);
    const setup = await this.buildTotpSetupPayload(user, secret);

    return {
      ...setup,
      message: 'Scan the QR code with your authenticator app, then enter a code to enable it.',
    };
  }

  async enableTotp(userId: string, _role: string, code: string) {
    const cleaned = String(code || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(cleaned)) {
      throw new BadRequestException('Enter the 6-digit code from your authenticator app.');
    }

    const user = await this.usersService.findById(userId);
    if (!user?.totpPendingSecret) {
      throw new BadRequestException('Start authenticator setup first, then confirm with a code.');
    }

    const result = verifySync({ token: cleaned, secret: user.totpPendingSecret });
    if (!result.valid) {
      throw new BadRequestException('Invalid authenticator code. Try again.');
    }

    const wasReplacing = Boolean(user.totpEnabled && user.totpSecret);
    await this.usersService.enableTotp(userId, user.totpPendingSecret);
    const refreshed = await this.usersService.findById(userId);
    if (!refreshed) throw new UnauthorizedException('User not found');
    const tokenPayload = this.issueAccessToken(refreshed);
    return {
      enabled: true,
      replaced: wasReplacing,
      message: wasReplacing
        ? 'Authenticator replaced. Your old app entry no longer works — remove it from your authenticator app.'
        : 'Authenticator app enabled. You can use it at sign-in.',
      ...tokenPayload,
    };
  }

  async requestReplaceTotp(userId: string, password: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('Authenticator is not enabled on this account.');
    }

    const passwordOk = await bcrypt.compare(password || '', user.password);
    if (!passwordOk) {
      throw new BadRequestException('Current password is incorrect.');
    }

    const code = this.generateEmailOtp();
    await this.usersService.setLoginOtp(userId, code);
    const mailResult = await this.mailService.sendTotpReplaceOtpEmail({
      to: user.email,
      name: user.name,
      code,
    });
    if (!mailResult.sent) {
      throw new BadRequestException(
        'We could not send the email code. Check SMTP settings or try again.',
      );
    }

    return {
      sent: true,
      emailHint: this.maskEmail(user.email),
      message:
        'We sent a 6-digit code to your email. Enter it below, then scan a new QR code. Confirming replaces your old authenticator.',
    };
  }

  async startReplaceTotp(
    userId: string,
    params: { password: string; code?: string },
  ) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('Authenticator is not enabled on this account.');
    }

    const passwordOk = await bcrypt.compare(params.password || '', user.password);
    if (!passwordOk) {
      throw new BadRequestException('Current password is incorrect.');
    }

    const cleaned = String(params.code || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(cleaned)) {
      throw new BadRequestException('Enter the 6-digit code from your email.');
    }

    const otpOk = await this.usersService.verifyLoginOtp(userId, cleaned);
    if (!otpOk) {
      throw new UnauthorizedException('Invalid or expired email code.');
    }

    const secret = generateSecret();
    await this.usersService.setTotpPendingSecret(userId, secret);
    await this.usersService.clearLoginOtp(userId);
    const setup = await this.buildTotpSetupPayload(user, secret);

    return {
      ...setup,
      replacing: true,
      message:
        'Scan the new QR code, then enter a code from the new app. Confirming deletes your old authenticator secret.',
    };
  }

  async requestDisableTotp(userId: string, password: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    if (user.role !== 'ADMIN') {
      throw new BadRequestException(
        'Authenticator is required for your role and cannot be disabled.',
      );
    }
    if (!user.totpEnabled) {
      throw new BadRequestException('Authenticator is not enabled on this account.');
    }

    const passwordOk = await bcrypt.compare(password || '', user.password);
    if (!passwordOk) {
      throw new BadRequestException('Current password is incorrect.');
    }

    const code = this.generateEmailOtp();
    await this.usersService.setLoginOtp(userId, code);
    const mailResult = await this.mailService.sendTotpDisableOtpEmail({
      to: user.email,
      name: user.name,
      code,
    });
    if (!mailResult.sent) {
      throw new BadRequestException(
        'We could not send the email code. Check SMTP settings or try again.',
      );
    }

    return {
      sent: true,
      emailHint: this.maskEmail(user.email),
      message: 'We sent a 6-digit code to your email. Enter it below to disable authenticator.',
    };
  }

  async disableTotp(
    userId: string,
    role: string,
    params: { password: string; code?: string },
  ) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    if (role !== 'ADMIN' && user.role !== 'ADMIN') {
      throw new BadRequestException(
        'Authenticator is required for your role and cannot be disabled.',
      );
    }

    const passwordOk = await bcrypt.compare(params.password || '', user.password);
    if (!passwordOk) {
      throw new BadRequestException('Current password is incorrect.');
    }

    if (!user.totpEnabled) {
      throw new BadRequestException('Authenticator is not enabled on this account.');
    }

    const cleaned = String(params.code || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(cleaned)) {
      throw new BadRequestException('Enter the 6-digit code from your email.');
    }

    const otpOk = await this.usersService.verifyLoginOtp(userId, cleaned);
    if (!otpOk) {
      throw new UnauthorizedException('Invalid or expired email code.');
    }

    await this.usersService.disableTotp(userId);
    await this.usersService.clearLoginOtp(userId);
    return {
      enabled: false,
      message:
        user.role === 'ADMIN'
          ? 'Authenticator app disabled. Admin sign-in is password only again.'
          : 'Authenticator app disabled. Email verification will still be required at sign-in.',
    };
  }

  private validateNewPassword(newPassword: string, confirmPassword?: string): void {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters.');
    }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      throw new BadRequestException('New password must include at least one letter and one number.');
    }
    if (confirmPassword != null && newPassword !== confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalized = email?.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) {
      throw new BadRequestException('Please enter a valid email address.');
    }

    const reset = await this.usersService.createPasswordResetToken(normalized);
    if (reset) {
      const mailResult = await this.mailService.sendPasswordResetEmail({
        to: normalized,
        name: reset.name,
        token: reset.token,
      });
      if (!mailResult.sent) {
        throw new BadRequestException(
          'We could not send the reset email. Check SMTP settings or contact your administrator.',
        );
      }
    }

    return {
      message:
        'If an account exists for that email, a password reset link has been sent. Please check your inbox.',
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<{ message: string }> {
    if (!token?.trim()) {
      throw new BadRequestException('Invalid or expired reset link.');
    }
    this.validateNewPassword(newPassword, confirmPassword);

    const user = await this.usersService.findByValidResetToken(token.trim());
    if (!user) {
      throw new BadRequestException('Invalid or expired reset link. Please request a new one.');
    }

    await this.usersService.resetPasswordWithToken(user._id.toString(), newPassword);

    return { message: 'Your password has been updated. You can sign in now.' };
  }

  async validateResetToken(token: string): Promise<{ valid: boolean }> {
    if (!token?.trim()) return { valid: false };
    const user = await this.usersService.findByValidResetToken(token.trim());
    return { valid: Boolean(user) };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword?: string,
  ): Promise<{ access_token: string; user: any }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const currentOk = await bcrypt.compare(currentPassword, user.password);
    if (!currentOk) {
      throw new BadRequestException('Current password is incorrect.');
    }

    this.validateNewPassword(newPassword, confirmPassword);

    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from your current password.');
    }

    await this.usersService.updatePassword(userId, newPassword, {
      requireChangeOnNextLogin: false,
    });

    const refreshed = await this.usersService.findById(userId);
    if (!refreshed) throw new UnauthorizedException('User not found');

    return this.issueAccessToken(refreshed);
  }

  async seed() {
    const admin = await this.usersService.seedAdmin();
    const categories = await this.categoriesService.ensureDefaults();
    const countries = await this.countriesService.ensureDefaults();
    return {
      ...admin,
      categories,
      countries,
      message: `${admin.message} ${categories.message} ${countries.message}`.trim(),
    };
  }
}
