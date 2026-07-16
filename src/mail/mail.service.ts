import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  private isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('SMTP_HOST') &&
        this.config.get<string>('SMTP_USER') &&
        this.config.get<string>('SMTP_PASS'),
    );
  }

  async sendWelcomeEmail(params: {
    to: string;
    name: string;
    email: string;
    temporaryPassword: string;
    role: string;
  }): Promise<{ sent: boolean; reason?: string }> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const loginUrl = `${frontendUrl.replace(/\/$/, '')}/login/`;
    const subject = 'Welcome to Aceolution Finance';
    const text = [
      `Hello ${params.name},`,
      '',
      'An account has been created for you on Aceolution Finance.',
      '',
      `Email: ${params.email}`,
      `Temporary password: ${params.temporaryPassword}`,
      `Role: ${params.role}`,
      '',
      `Sign in here: ${loginUrl}`,
      '',
      'For security, you must set a new password after your first login before you can use the dashboard.',
      '',
      '— Aceolution Finance',
    ].join('\n');

    const html = `
      <div style="font-family:Calibri,Arial,sans-serif;color:#1e293b;line-height:1.5;max-width:560px">
        <h2 style="color:#203c62;margin:0 0 12px">Welcome to Aceolution Finance</h2>
        <p>Hello <strong>${params.name}</strong>,</p>
        <p>An account has been created for you. Use these credentials to sign in:</p>
        <table style="border-collapse:collapse;margin:16px 0;width:100%">
          <tr><td style="padding:8px 12px;background:#f1f5f9;border:1px solid #d7dee8">Email</td>
              <td style="padding:8px 12px;border:1px solid #d7dee8"><strong>${params.email}</strong></td></tr>
          <tr><td style="padding:8px 12px;background:#f1f5f9;border:1px solid #d7dee8">Temporary password</td>
              <td style="padding:8px 12px;border:1px solid #d7dee8"><strong>${params.temporaryPassword}</strong></td></tr>
          <tr><td style="padding:8px 12px;background:#f1f5f9;border:1px solid #d7dee8">Role</td>
              <td style="padding:8px 12px;border:1px solid #d7dee8">${params.role}</td></tr>
        </table>
        <p><a href="${loginUrl}" style="display:inline-block;background:#203c62;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">Sign In</a></p>
        <p style="font-size:13px;color:#64748b">For security, you must set a new password after your first login before you can access the dashboard.</p>
      </div>
    `;

    if (!this.isConfigured()) {
      this.logger.warn(
        `SMTP not configured — welcome email for ${params.email} was not sent. Password was set by admin.`,
      );
      this.logger.log(`Welcome credentials for ${params.email}: temp password set (not logged for security).`);
      return { sent: false, reason: 'SMTP not configured' };
    }

    try {
      const port = Number(this.config.get<string>('SMTP_PORT') || 587);
      const transporter = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST'),
        port,
        secure: port === 465,
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });

      const from =
        this.config.get<string>('SMTP_FROM') ||
        this.config.getOrThrow<string>('SMTP_USER');

      await transporter.sendMail({
        from: `"Aceolution Finance" <${from}>`,
        to: params.to,
        subject,
        text,
        html,
      });

      return { sent: true };
    } catch (err: any) {
      this.logger.error(`Failed to send welcome email to ${params.to}: ${err.message}`);
      return { sent: false, reason: err.message || 'Email send failed' };
    }
  }

  async sendPasswordResetEmail(params: {
    to: string;
    name: string;
    token: string;
  }): Promise<{ sent: boolean; reason?: string }> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const resetUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password/?token=${encodeURIComponent(params.token)}`;
    const subject = 'Reset your Aceolution Finance password';
    const text = [
      `Hello ${params.name},`,
      '',
      'We received a request to reset your Aceolution Finance password.',
      '',
      `Reset your password here: ${resetUrl}`,
      '',
      'This link expires in 1 hour. If you did not request this, you can ignore this email.',
      '',
      '— Aceolution Finance',
    ].join('\n');

    const html = `
      <div style="font-family:Calibri,Arial,sans-serif;color:#1e293b;line-height:1.5;max-width:560px">
        <h2 style="color:#203c62;margin:0 0 12px">Reset your password</h2>
        <p>Hello <strong>${params.name}</strong>,</p>
        <p>We received a request to reset your Aceolution Finance password.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#203c62;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">Set New Password</a></p>
        <p style="font-size:13px;color:#64748b">This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
      </div>
    `;

    if (!this.isConfigured()) {
      this.logger.warn(`SMTP not configured — password reset email for ${params.to} was not sent.`);
      return { sent: false, reason: 'SMTP not configured' };
    }

    try {
      const port = Number(this.config.get<string>('SMTP_PORT') || 587);
      const transporter = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST'),
        port,
        secure: port === 465,
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });

      const from =
        this.config.get<string>('SMTP_FROM') ||
        this.config.getOrThrow<string>('SMTP_USER');

      await transporter.sendMail({
        from: `"Aceolution Finance" <${from}>`,
        to: params.to,
        subject,
        text,
        html,
      });

      return { sent: true };
    } catch (err: any) {
      this.logger.error(`Failed to send password reset email to ${params.to}: ${err.message}`);
      return { sent: false, reason: err.message || 'Email send failed' };
    }
  }
}
