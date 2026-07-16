import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { CategoriesService } from '../categories/categories.service';
import { CountriesService } from '../countries/countries.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private categoriesService: CategoriesService,
    private countriesService: CountriesService,
    private mailService: MailService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid email or password');
    if (!user.isActive) throw new UnauthorizedException('Your account has been deactivated');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid email or password');
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    const mustChangePassword = Boolean(user.mustChangePassword);
    const payload = {
      sub: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword,
      },
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
  ): Promise<{ access_token: string; user: any }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const currentOk = await bcrypt.compare(currentPassword, user.password);
    if (!currentOk) {
      throw new BadRequestException('Current password is incorrect.');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters.');
    }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      throw new BadRequestException('New password must include at least one letter and one number.');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from the temporary password.');
    }

    await this.usersService.updatePassword(userId, newPassword, {
      requireChangeOnNextLogin: false,
    });

    const refreshed = await this.usersService.findById(userId);
    if (!refreshed) throw new UnauthorizedException('User not found');

    const payload = {
      sub: refreshed._id.toString(),
      name: refreshed.name,
      email: refreshed.email,
      role: refreshed.role,
      mustChangePassword: false,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: refreshed._id.toString(),
        name: refreshed.name,
        email: refreshed.email,
        role: refreshed.role,
        mustChangePassword: false,
      },
    };
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
