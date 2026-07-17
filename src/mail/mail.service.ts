import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export type ExpenseMailSummary = {
  id: string;
  requesterName: string;
  requesterEmail: string;
  description: string;
  category: string;
  project: string;
  country: string;
  currency: string;
  originalAmount: number;
  amountUsd: number;
  dueDate?: string;
  notes?: string;
};

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

  private frontendBase(): string {
    return (this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000').replace(/\/$/, '');
  }

  private escapeHtml(value: string): string {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private formatMoney(amount: number, currency = 'USD'): string {
    const n = Number(amount);
    if (!Number.isFinite(n)) return String(amount);
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
        maximumFractionDigits: 2,
      }).format(n);
    } catch {
      return `${n.toFixed(2)} ${currency}`;
    }
  }

  private expenseDetailsHtml(expense: ExpenseMailSummary): string {
    const rows: Array<[string, string]> = [
      ['Request ID', expense.id],
      ['Requester', `${expense.requesterName} (${expense.requesterEmail})`],
      ['Category', expense.category],
      ['Project', expense.project],
      ['Country', expense.country],
      [
        'Amount',
        `${this.formatMoney(expense.originalAmount, expense.currency)} (≈ ${this.formatMoney(expense.amountUsd, 'USD')})`,
      ],
    ];
    if (expense.dueDate) rows.push(['Due date', expense.dueDate]);
    if (expense.description) rows.push(['Description', expense.description]);
    if (expense.notes) rows.push(['Notes', expense.notes]);

    return `
      <table style="border-collapse:collapse;margin:16px 0;width:100%">
        ${rows
          .map(
            ([label, value]) => `
          <tr>
            <td style="padding:8px 12px;background:#f1f5f9;border:1px solid #d7dee8;width:140px">${this.escapeHtml(label)}</td>
            <td style="padding:8px 12px;border:1px solid #d7dee8">${this.escapeHtml(value)}</td>
          </tr>`,
          )
          .join('')}
      </table>
    `;
  }

  private expenseDetailsText(expense: ExpenseMailSummary): string {
    const lines = [
      `Request ID: ${expense.id}`,
      `Requester: ${expense.requesterName} (${expense.requesterEmail})`,
      `Category: ${expense.category}`,
      `Project: ${expense.project}`,
      `Country: ${expense.country}`,
      `Amount: ${this.formatMoney(expense.originalAmount, expense.currency)} (≈ ${this.formatMoney(expense.amountUsd, 'USD')})`,
    ];
    if (expense.dueDate) lines.push(`Due date: ${expense.dueDate}`);
    if (expense.description) lines.push(`Description: ${expense.description}`);
    if (expense.notes) lines.push(`Notes: ${expense.notes}`);
    return lines.join('\n');
  }

  private async sendMail(params: {
    to: string;
    subject: string;
    text: string;
    html: string;
    context: string;
  }): Promise<{ sent: boolean; reason?: string }> {
    if (!params.to?.trim()) {
      return { sent: false, reason: 'Missing recipient' };
    }

    if (!this.isConfigured()) {
      this.logger.warn(`SMTP not configured — ${params.context} email to ${params.to} was not sent.`);
      return { sent: false, reason: 'SMTP not configured' };
    }

    try {
      const port = Number(this.config.get<string>('SMTP_PORT') || 587);
      const host = this.config.get<string>('SMTP_HOST') || 'smtp.gmail.com';
      const user = this.config.get<string>('SMTP_USER')?.trim();
      const pass = this.config.get<string>('SMTP_PASS')?.replace(/\s+/g, '');

      const transportOptions: nodemailer.TransportOptions = {
        host,
        port,
        secure: port === 465,
        requireTLS: port === 587,
        // Render free tier often cannot reach Gmail over IPv6 (ENETUNREACH)
        family: 4,
        auth: user && pass ? { user, pass } : undefined,
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 20_000,
        tls: {
          minVersion: 'TLSv1.2',
        },
      } as nodemailer.TransportOptions;

      const transporter = nodemailer.createTransport(transportOptions);

      const from =
        this.config.get<string>('SMTP_FROM')?.trim() ||
        user ||
        this.config.getOrThrow<string>('SMTP_USER');

      await transporter.sendMail({
        from: `"Aceolution Finance" <${from}>`,
        to: params.to.trim(),
        subject: params.subject,
        text: params.text,
        html: params.html,
      });

      return { sent: true };
    } catch (err: any) {
      const reason = err?.response || err?.message || 'Email send failed';
      this.logger.error(
        `Failed to send ${params.context} email to ${params.to}: ${reason}`,
      );
      return { sent: false, reason: String(reason) };
    }
  }

  private wrapHtml(title: string, bodyHtml: string, ctaLabel?: string, ctaUrl?: string): string {
    const cta =
      ctaLabel && ctaUrl
        ? `<p><a href="${ctaUrl}" style="display:inline-block;background:#203c62;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">${this.escapeHtml(ctaLabel)}</a></p>`
        : '';
    return `
      <div style="font-family:Calibri,Arial,sans-serif;color:#1e293b;line-height:1.5;max-width:560px">
        <h2 style="color:#203c62;margin:0 0 12px">${this.escapeHtml(title)}</h2>
        ${bodyHtml}
        ${cta}
        <p style="font-size:13px;color:#64748b;margin-top:24px">— Aceolution Finance</p>
      </div>
    `;
  }

  async sendWelcomeEmail(params: {
    to: string;
    name: string;
    email: string;
    temporaryPassword: string;
    role: string;
  }): Promise<{ sent: boolean; reason?: string }> {
    const loginUrl = `${this.frontendBase()}/login/`;
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

    const html = this.wrapHtml(
      'Welcome to Aceolution Finance',
      `
        <p>Hello <strong>${this.escapeHtml(params.name)}</strong>,</p>
        <p>An account has been created for you. Use these credentials to sign in:</p>
        <table style="border-collapse:collapse;margin:16px 0;width:100%">
          <tr><td style="padding:8px 12px;background:#f1f5f9;border:1px solid #d7dee8">Email</td>
              <td style="padding:8px 12px;border:1px solid #d7dee8"><strong>${this.escapeHtml(params.email)}</strong></td></tr>
          <tr><td style="padding:8px 12px;background:#f1f5f9;border:1px solid #d7dee8">Temporary password</td>
              <td style="padding:8px 12px;border:1px solid #d7dee8"><strong>${this.escapeHtml(params.temporaryPassword)}</strong></td></tr>
          <tr><td style="padding:8px 12px;background:#f1f5f9;border:1px solid #d7dee8">Role</td>
              <td style="padding:8px 12px;border:1px solid #d7dee8">${this.escapeHtml(params.role)}</td></tr>
        </table>
        <p style="font-size:13px;color:#64748b">For security, you must set a new password after your first login before you can access the dashboard.</p>
      `,
      'Sign In',
      loginUrl,
    );

    return this.sendMail({
      to: params.to,
      subject,
      text,
      html,
      context: 'welcome',
    });
  }

  async sendPasswordResetEmail(params: {
    to: string;
    name: string;
    token: string;
  }): Promise<{ sent: boolean; reason?: string }> {
    const resetUrl = `${this.frontendBase()}/reset-password/?token=${encodeURIComponent(params.token)}`;
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

    const html = this.wrapHtml(
      'Reset your password',
      `
        <p>Hello <strong>${this.escapeHtml(params.name)}</strong>,</p>
        <p>We received a request to reset your Aceolution Finance password.</p>
        <p style="font-size:13px;color:#64748b">This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
      `,
      'Set New Password',
      resetUrl,
    );

    return this.sendMail({
      to: params.to,
      subject,
      text,
      html,
      context: 'password reset',
    });
  }

  async sendLoginOtpEmail(params: {
    to: string;
    name: string;
    code: string;
  }): Promise<{ sent: boolean; reason?: string }> {
    const subject = 'Your Aceolution Finance sign-in code';
    const text = [
      `Hello ${params.name},`,
      '',
      `Your verification code is: ${params.code}`,
      '',
      'This code expires in 10 minutes. If you did not try to sign in, you can ignore this email.',
      '',
      '— Aceolution Finance',
    ].join('\n');

    const html = this.wrapHtml(
      'Your sign-in code',
      `
        <p>Hello <strong>${this.escapeHtml(params.name)}</strong>,</p>
        <p>Use this code to finish signing in to Aceolution Finance:</p>
        <p style="font-size:28px;letter-spacing:6px;font-weight:700;color:#203c62;margin:20px 0">${this.escapeHtml(params.code)}</p>
        <p style="font-size:13px;color:#64748b">This code expires in 10 minutes. If you did not try to sign in, you can ignore this email.</p>
      `,
    );

    return this.sendMail({
      to: params.to,
      subject,
      text,
      html,
      context: 'login otp',
    });
  }

  async sendTotpDisableOtpEmail(params: {
    to: string;
    name: string;
    code: string;
  }): Promise<{ sent: boolean; reason?: string }> {
    const subject = 'Disable authenticator — Aceolution Finance';
    const text = [
      `Hello ${params.name},`,
      '',
      `Your code to disable the authenticator app is: ${params.code}`,
      '',
      'This code expires in 10 minutes. If you did not request this, keep your authenticator enabled and contact your administrator.',
      '',
      '— Aceolution Finance',
    ].join('\n');

    const html = this.wrapHtml(
      'Disable authenticator app',
      `
        <p>Hello <strong>${this.escapeHtml(params.name)}</strong>,</p>
        <p>Use this code to disable your authenticator app (for example after reinstalling the app):</p>
        <p style="font-size:28px;letter-spacing:6px;font-weight:700;color:#203c62;margin:20px 0">${this.escapeHtml(params.code)}</p>
        <p style="font-size:13px;color:#64748b">This code expires in 10 minutes. If you did not request this, ignore this email.</p>
      `,
    );

    return this.sendMail({
      to: params.to,
      subject,
      text,
      html,
      context: 'totp disable otp',
    });
  }

  /** Confirmation to the requester after a new expense is submitted. */
  async sendExpenseSubmittedToRequester(
    expense: ExpenseMailSummary,
  ): Promise<{ sent: boolean; reason?: string }> {
    const myRequestsUrl = `${this.frontendBase()}/dashboard/my-requests/`;
    const subject = `Expense request submitted — ${expense.id}`;
    const text = [
      `Hello ${expense.requesterName},`,
      '',
      'Your expense request has been submitted and is awaiting approver review.',
      '',
      this.expenseDetailsText(expense),
      '',
      `Track your request: ${myRequestsUrl}`,
      '',
      '— Aceolution Finance',
    ].join('\n');

    const html = this.wrapHtml(
      'Expense request submitted',
      `
        <p>Hello <strong>${this.escapeHtml(expense.requesterName)}</strong>,</p>
        <p>Your expense request has been submitted and is awaiting approver review.</p>
        ${this.expenseDetailsHtml(expense)}
      `,
      'View My Requests',
      myRequestsUrl,
    );

    return this.sendMail({
      to: expense.requesterEmail,
      subject,
      text,
      html,
      context: 'expense submitted (requester)',
    });
  }

  /** Notify approvers that a new request needs review. */
  async sendExpenseSubmittedToApprover(params: {
    to: string;
    approverName: string;
    expense: ExpenseMailSummary;
  }): Promise<{ sent: boolean; reason?: string }> {
    const queueUrl = `${this.frontendBase()}/dashboard/approver/`;
    const subject = `New expense awaiting approval — ${params.expense.id}`;
    const text = [
      `Hello ${params.approverName},`,
      '',
      'A new expense request has been submitted and needs your approval.',
      '',
      this.expenseDetailsText(params.expense),
      '',
      `Open approver queue: ${queueUrl}`,
      '',
      '— Aceolution Finance',
    ].join('\n');

    const html = this.wrapHtml(
      'New expense awaiting approval',
      `
        <p>Hello <strong>${this.escapeHtml(params.approverName)}</strong>,</p>
        <p>A new expense request has been submitted and needs your approval.</p>
        ${this.expenseDetailsHtml(params.expense)}
      `,
      'Open Approver Queue',
      queueUrl,
    );

    return this.sendMail({
      to: params.to,
      subject,
      text,
      html,
      context: 'expense submitted (approver)',
    });
  }

  /** Requester notified when approver rejects. */
  async sendExpenseRejectedByApprover(
    expense: ExpenseMailSummary,
  ): Promise<{ sent: boolean; reason?: string }> {
    const myRequestsUrl = `${this.frontendBase()}/dashboard/my-requests/`;
    const subject = `Expense rejected by approver — ${expense.id}`;
    const text = [
      `Hello ${expense.requesterName},`,
      '',
      'Your expense request has been rejected by an approver.',
      '',
      this.expenseDetailsText(expense),
      '',
      `View request: ${myRequestsUrl}`,
      '',
      '— Aceolution Finance',
    ].join('\n');

    const html = this.wrapHtml(
      'Expense rejected by approver',
      `
        <p>Hello <strong>${this.escapeHtml(expense.requesterName)}</strong>,</p>
        <p>Your expense request has been <strong>rejected by an approver</strong>.</p>
        ${this.expenseDetailsHtml(expense)}
      `,
      'View My Requests',
      myRequestsUrl,
    );

    return this.sendMail({
      to: expense.requesterEmail,
      subject,
      text,
      html,
      context: 'expense rejected by approver',
    });
  }

  /** Requester notified when staff requests changes (edit + resubmit). */
  async sendExpenseChangesRequestedToRequester(
    expense: ExpenseMailSummary,
  ): Promise<{ sent: boolean; reason?: string }> {
    const myRequestsUrl = `${this.frontendBase()}/dashboard/my-requests/`;
    const subject = `Changes requested on expense — ${expense.id}`;
    const text = [
      `Hello ${expense.requesterName},`,
      '',
      'Changes have been requested on your expense. Please edit and resubmit it.',
      '',
      this.expenseDetailsText(expense),
      '',
      `Edit request: ${myRequestsUrl}`,
      '',
      '— Aceolution Finance',
    ].join('\n');

    const html = this.wrapHtml(
      'Changes requested on your expense',
      `
        <p>Hello <strong>${this.escapeHtml(expense.requesterName)}</strong>,</p>
        <p>Changes have been requested on your expense. Please <strong>edit and resubmit</strong> it from My Requests.</p>
        ${this.expenseDetailsHtml(expense)}
      `,
      'Edit My Requests',
      myRequestsUrl,
    );

    return this.sendMail({
      to: expense.requesterEmail,
      subject,
      text,
      html,
      context: 'expense changes requested (requester)',
    });
  }

  /** Approvers notified when a processor returns an approved expense for re-review. */
  async sendExpenseReturnedToApprover(params: {
    to: string;
    approverName: string;
    expense: ExpenseMailSummary;
  }): Promise<{ sent: boolean; reason?: string }> {
    const queueUrl = `${this.frontendBase()}/dashboard/approver/`;
    const subject = `Expense returned for re-approval — ${params.expense.id}`;
    const text = [
      `Hello ${params.approverName},`,
      '',
      'An approved expense has been returned to the approver queue for re-review.',
      '',
      this.expenseDetailsText(params.expense),
      '',
      `Open approver queue: ${queueUrl}`,
      '',
      '— Aceolution Finance',
    ].join('\n');

    const html = this.wrapHtml(
      'Expense returned for re-approval',
      `
        <p>Hello <strong>${this.escapeHtml(params.approverName)}</strong>,</p>
        <p>An approved expense has been <strong>returned to the approver queue</strong> for re-review.</p>
        ${this.expenseDetailsHtml(params.expense)}
      `,
      'Open Approver Queue',
      queueUrl,
    );

    return this.sendMail({
      to: params.to,
      subject,
      text,
      html,
      context: 'expense returned to approver',
    });
  }

  /** Processors notified when approver approves. */
  async sendExpenseApprovedToProcessor(params: {
    to: string;
    processorName: string;
    expense: ExpenseMailSummary;
  }): Promise<{ sent: boolean; reason?: string }> {
    const queueUrl = `${this.frontendBase()}/dashboard/processor/`;
    const subject = `Expense approved — ready for payment — ${params.expense.id}`;
    const text = [
      `Hello ${params.processorName},`,
      '',
      'An expense request has been approved and is ready for payment processing.',
      '',
      this.expenseDetailsText(params.expense),
      '',
      `Open processor queue: ${queueUrl}`,
      '',
      '— Aceolution Finance',
    ].join('\n');

    const html = this.wrapHtml(
      'Expense approved — ready for payment',
      `
        <p>Hello <strong>${this.escapeHtml(params.processorName)}</strong>,</p>
        <p>An expense request has been <strong>approved</strong> and is ready for payment processing.</p>
        ${this.expenseDetailsHtml(params.expense)}
      `,
      'Open Processor Queue',
      queueUrl,
    );

    return this.sendMail({
      to: params.to,
      subject,
      text,
      html,
      context: 'expense approved (processor)',
    });
  }

  /** Requester notified when processor rejects. */
  async sendExpenseRejectedByProcessor(
    expense: ExpenseMailSummary,
  ): Promise<{ sent: boolean; reason?: string }> {
    const myRequestsUrl = `${this.frontendBase()}/dashboard/my-requests/`;
    const subject = `Expense rejected by processor — ${expense.id}`;
    const text = [
      `Hello ${expense.requesterName},`,
      '',
      'Your expense request has been rejected by a processor.',
      '',
      this.expenseDetailsText(expense),
      '',
      `View request: ${myRequestsUrl}`,
      '',
      '— Aceolution Finance',
    ].join('\n');

    const html = this.wrapHtml(
      'Expense rejected by processor',
      `
        <p>Hello <strong>${this.escapeHtml(expense.requesterName)}</strong>,</p>
        <p>Your expense request has been <strong>rejected by a processor</strong>.</p>
        ${this.expenseDetailsHtml(expense)}
      `,
      'View My Requests',
      myRequestsUrl,
    );

    return this.sendMail({
      to: expense.requesterEmail,
      subject,
      text,
      html,
      context: 'expense rejected by processor',
    });
  }

  /** Requester notified when request is fully paid. */
  async sendExpenseFullyPaidToRequester(
    expense: ExpenseMailSummary,
  ): Promise<{ sent: boolean; reason?: string }> {
    const myRequestsUrl = `${this.frontendBase()}/dashboard/my-requests/`;
    const subject = `Expense paid — ${expense.id}`;
    const text = [
      `Hello ${expense.requesterName},`,
      '',
      'Your expense request has been fully paid.',
      '',
      this.expenseDetailsText(expense),
      '',
      `View request: ${myRequestsUrl}`,
      '',
      '— Aceolution Finance',
    ].join('\n');

    const html = this.wrapHtml(
      'Expense paid',
      `
        <p>Hello <strong>${this.escapeHtml(expense.requesterName)}</strong>,</p>
        <p>Your expense request has been <strong>fully paid</strong>.</p>
        ${this.expenseDetailsHtml(expense)}
      `,
      'View My Requests',
      myRequestsUrl,
    );

    return this.sendMail({
      to: expense.requesterEmail,
      subject,
      text,
      html,
      context: 'expense fully paid',
    });
  }

  /** Reminder to approvers when a pending request has only 1 day left. */
  async sendExpenseDueSoonToApprover(params: {
    to: string;
    approverName: string;
    expense: ExpenseMailSummary;
  }): Promise<{ sent: boolean; reason?: string }> {
    const queueUrl = `${this.frontendBase()}/dashboard/approver/`;
    const subject = `Reminder: expense due tomorrow — ${params.expense.id}`;
    const text = [
      `Hello ${params.approverName},`,
      '',
      'This expense request is still awaiting your approval and is due tomorrow (1 day left).',
      '',
      this.expenseDetailsText(params.expense),
      '',
      `Open approver queue: ${queueUrl}`,
      '',
      '— Aceolution Finance',
    ].join('\n');

    const html = this.wrapHtml(
      'Reminder: expense due tomorrow',
      `
        <p>Hello <strong>${this.escapeHtml(params.approverName)}</strong>,</p>
        <p>This expense request is still awaiting your approval and has <strong>1 day left</strong> until the due date.</p>
        ${this.expenseDetailsHtml(params.expense)}
      `,
      'Open Approver Queue',
      queueUrl,
    );

    return this.sendMail({
      to: params.to,
      subject,
      text,
      html,
      context: 'expense due soon (approver)',
    });
  }

  /** Reminder to processors when an approved request has only 1 day left and is not fully paid. */
  async sendExpenseDueSoonToProcessor(params: {
    to: string;
    processorName: string;
    expense: ExpenseMailSummary;
  }): Promise<{ sent: boolean; reason?: string }> {
    const queueUrl = `${this.frontendBase()}/dashboard/processor/`;
    const subject = `Reminder: approved expense due tomorrow — ${params.expense.id}`;
    const text = [
      `Hello ${params.processorName},`,
      '',
      'This expense request is approved and still awaiting payment. It is due tomorrow (1 day left).',
      '',
      this.expenseDetailsText(params.expense),
      '',
      `Open processor queue: ${queueUrl}`,
      '',
      '— Aceolution Finance',
    ].join('\n');

    const html = this.wrapHtml(
      'Reminder: approved expense due tomorrow',
      `
        <p>Hello <strong>${this.escapeHtml(params.processorName)}</strong>,</p>
        <p>This expense request is <strong>already approved</strong> and still awaiting payment. It has <strong>1 day left</strong> until the due date.</p>
        ${this.expenseDetailsHtml(params.expense)}
      `,
      'Open Processor Queue',
      queueUrl,
    );

    return this.sendMail({
      to: params.to,
      subject,
      text,
      html,
      context: 'expense due soon (processor)',
    });
  }
}
