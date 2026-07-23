import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Expense, ExpenseDocument } from './expense.schema';
import { CategoriesService } from '../categories/categories.service';
import { ProjectsService } from '../projects/projects.service';
import { CountriesService } from '../countries/countries.service';
import { FxService } from '../fx/fx.service';
import { MailService, ExpenseMailSummary } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { StorageService } from '../storage/storage.service';

export interface ActingUser {
  userId: string;
  name: string;
  email: string;
  role: string;
}

export interface CreateExpenseInput {
  requesterName: string;
  requesterEmail: string;
  /** Local-currency amount entered by requester */
  originalAmount: number;
  country: string;
  category: string;
  project: string;
  description: string;
  date: string;
  dueDate: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  /** Pre-generated id (so invoice filename can include it before save) */
  id?: string;
}

export interface InvoiceUploadMeta {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export type PaymentReceiptUploadMeta = InvoiceUploadMeta;

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
    private readonly categoriesService: CategoriesService,
    private readonly projectsService: ProjectsService,
    private readonly countriesService: CountriesService,
    private readonly fxService: FxService,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
    private readonly storageService: StorageService,
  ) {}

  /** e.g. EXP-1784269812102-4653 */
  generateExpenseId(): string {
    return `EXP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  private async removeInvoiceFile(fileName?: string) {
    await this.storageService.deleteAttachment('invoices', fileName);
  }

  private async removeReceiptFile(fileName?: string) {
    await this.storageService.deleteAttachment('receipts', fileName);
  }

  private pushPaymentReceipt(
    expense: ExpenseDocument,
    receipt: PaymentReceiptUploadMeta,
    actingUser: ActingUser | undefined,
    paymentAmount?: number,
  ) {
    if (!expense.paymentReceipts) expense.paymentReceipts = [];
    expense.paymentReceipts.push({
      fileName: receipt.fileName,
      originalName: receipt.originalName,
      mimeType: receipt.mimeType,
      size: receipt.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: actingUser ? `${actingUser.name} (${actingUser.email})` : 'Processor',
      paymentAmount,
    });
  }

  private toMailSummary(
    expense: Expense | ExpenseDocument,
    notes?: string,
  ): ExpenseMailSummary {
    return {
      id: expense.id,
      requesterName: expense.requesterName,
      requesterEmail: expense.requesterEmail,
      description: expense.description,
      category: expense.category,
      project: expense.project,
      country: expense.country || '',
      currency: expense.currency || 'USD',
      originalAmount: Number(expense.originalAmount),
      amountUsd: Number(expense.amount),
      dueDate: expense.dueDate,
      invoiceNumber: expense.invoiceNumber,
      invoiceDate: expense.invoiceDate,
      notes: notes || undefined,
    };
  }

  /** Email failures must never block the expense workflow. */
  private notify(label: string, task: Promise<{ sent: boolean; reason?: string }>) {
    void task
      .then((result) => {
        if (!result.sent) {
          this.logger.warn(`Workflow email (${label}) not sent: ${result.reason || 'unknown'}`);
        }
      })
      .catch((err: any) => {
        this.logger.error(`Workflow email (${label}) failed: ${err?.message || err}`);
      });
  }

  private async notifyApproversOfSubmission(expense: Expense | ExpenseDocument) {
    const summary = this.toMailSummary(expense);
    this.notify(
      `submitted→requester ${expense.id}`,
      this.mailService.sendExpenseSubmittedToRequester(summary),
    );

    const approvers = await this.usersService.findActiveApproversForProject(expense.project);
    if (approvers.length === 0) {
      this.logger.warn(
        `No active APPROVER users assigned to project "${expense.project}" for expense ${expense.id}`,
      );
      return;
    }
    for (const approver of approvers) {
      this.notify(
        `submitted→approver ${approver.email} ${expense.id}`,
        this.mailService.sendExpenseSubmittedToApprover({
          to: approver.email,
          approverName: approver.name,
          expense: summary,
        }),
      );
    }
  }

  private async notifyProcessorsOfApproval(expense: Expense | ExpenseDocument, notes?: string) {
    const summary = this.toMailSummary(expense, notes);
    const processors = await this.usersService.findActiveByRole('PROCESSOR');
    if (processors.length === 0) {
      this.logger.warn(`No active PROCESSOR users to notify for expense ${expense.id}`);
      return;
    }
    for (const processor of processors) {
      this.notify(
        `approved→processor ${processor.email} ${expense.id}`,
        this.mailService.sendExpenseApprovedToProcessor({
          to: processor.email,
          processorName: processor.name,
          expense: summary,
        }),
      );
    }
  }

  async create(
    expenseData: CreateExpenseInput,
    invoice?: InvoiceUploadMeta,
  ): Promise<Expense> {
    if (!invoice?.fileName) {
      throw new BadRequestException('Invoice attachment is required.');
    }

    const category = await this.categoriesService.assertActiveName(expenseData.category);
    const project = await this.projectsService.assertActiveName(expenseData.project);
    const country = await this.countriesService.assertActiveCountry(expenseData.country);

    const requester = await this.usersService.findByEmail(expenseData.requesterEmail);
    if (requester?.role === 'REQUESTER') {
      if (!this.usersService.userHasProjectAccess(requester, project)) {
        throw new ForbiddenException(
          `You are not assigned to project "${project}". Contact an administrator.`,
        );
      }
    }

    if (!expenseData.dueDate) {
      throw new BadRequestException('Due date is required');
    }
    if (expenseData.dueDate < expenseData.date) {
      throw new BadRequestException('Due date cannot be before the expense date');
    }

    const fx = await this.fxService.convertToUsd(
      country.currency,
      Number(expenseData.originalAmount),
    );

    const now = new Date().toISOString();
    const id = expenseData.id || this.generateExpenseId();

    const newExpense = new this.expenseModel({
      requesterName: expenseData.requesterName,
      requesterEmail: expenseData.requesterEmail.trim().toLowerCase(),
      description: expenseData.description,
      date: expenseData.date,
      dueDate: expenseData.dueDate,
      invoiceNumber: expenseData.invoiceNumber,
      invoiceDate: expenseData.invoiceDate,
      category,
      project,
      country: country.name,
      currency: fx.currency,
      originalAmount: fx.originalAmount,
      exchangeRate: fx.exchangeRate,
      exchangeRateDate: fx.rateDate,
      amount: fx.amountUsd,
      paidAmount: 0,
      id,
      status: 'PENDING_APPROVER',
      submittedAt: now,
      invoiceFileName: invoice.fileName,
      invoiceOriginalName: invoice.originalName,
      invoiceMimeType: invoice.mimeType,
      invoiceSize: invoice.size,
      history: [
        {
          action: 'Submitted Request',
          timestamp: now,
          user: 'Public Requester',
          notes: `Expense of ${fx.originalAmount} ${fx.currency} (≈ $${fx.amountUsd} USD @ ${fx.exchangeRate}) submitted by ${expenseData.requesterName}. Invoice: ${invoice.originalName}.`,
        },
      ],
    });

    try {
      const saved = await newExpense.save();
      await this.notifyApproversOfSubmission(saved);
      return saved;
    } catch (err) {
      await this.removeInvoiceFile(invoice.fileName);
      throw err;
    }
  }

  async findAll(): Promise<Expense[]> {
    return this.expenseModel.find().sort({ submittedAt: -1 }).lean().exec();
  }

  async findAllForUser(actingUser: ActingUser): Promise<Expense[]> {
    const all = await this.findAll();
    if (actingUser.role !== 'APPROVER') {
      return all;
    }
    const user = await this.usersService.findById(actingUser.userId);
    const assigned = Array.isArray(user?.assignedProjects) ? user!.assignedProjects! : [];
    if (assigned.length === 0) return [];
    const allowed = new Set(assigned);
    return all.filter((e) => allowed.has(e.project));
  }

  private async assertApproverProjectAccess(
    expense: ExpenseDocument,
    actingUser?: ActingUser,
  ): Promise<void> {
    if (!actingUser || actingUser.role !== 'APPROVER') return;
    const user = await this.usersService.findById(actingUser.userId);
    if (!user || !this.usersService.userHasProjectAccess(user, expense.project)) {
      throw new ForbiddenException(
        `You are not assigned to project "${expense.project}" and cannot act on this expense.`,
      );
    }
  }

  async findMine(email: string): Promise<Expense[]> {
    return this.expenseModel
      .find({ requesterEmail: email.toLowerCase() })
      .sort({ submittedAt: -1 })
      .lean()
      .exec();
  }

  async findOne(id: string): Promise<Expense> {
    const expense = await this.expenseModel.findOne({ id }).lean().exec();
    if (!expense) {
      throw new NotFoundException(`Expense with ID ${id} not found`);
    }
    return expense;
  }

  async approve(id: string, notes?: string, actingUser?: ActingUser): Promise<Expense> {
    const expense = await this.expenseModel.findOne({ id }).exec();
    if (!expense) throw new NotFoundException(`Expense with ID ${id} not found`);
    if (expense.status !== 'PENDING_APPROVER') {
      throw new BadRequestException(`Cannot approve expense. Current status is ${expense.status}`);
    }
    await this.assertApproverProjectAccess(expense, actingUser);

    const now = new Date().toISOString();
    const userName = actingUser ? `${actingUser.name} (${actingUser.email})` : 'Approver';
    expense.status = 'APPROVED_APPROVER';
    expense.approverNotes = notes;
    expense.approvedAt = now;
    expense.history.push({
      action: 'Approved by Manager',
      timestamp: now,
      user: userName,
      notes: notes || 'Approved without review notes.',
    });
    const saved = await expense.save();
    await this.notifyProcessorsOfApproval(saved, notes);
    return saved;
  }

  async reject(id: string, notes?: string, actingUser?: ActingUser): Promise<Expense> {
    const expense = await this.expenseModel.findOne({ id }).exec();
    if (!expense) throw new NotFoundException(`Expense with ID ${id} not found`);
    if (expense.status !== 'PENDING_APPROVER') {
      throw new BadRequestException(`Cannot reject expense. Current status is ${expense.status}`);
    }
    await this.assertApproverProjectAccess(expense, actingUser);

    const now = new Date().toISOString();
    const userName = actingUser ? `${actingUser.name} (${actingUser.email})` : 'Approver';
    expense.status = 'REJECTED_APPROVER';
    expense.approverNotes = notes;
    expense.approvedAt = now;
    expense.history.push({
      action: 'Rejected by Manager',
      timestamp: now,
      user: userName,
      notes: notes || 'Rejected without review notes.',
    });
    const saved = await expense.save();
    this.notify(
      `rejected-by-approver ${saved.id}`,
      this.mailService.sendExpenseRejectedByApprover(this.toMailSummary(saved, notes)),
    );
    return saved;
  }

  /**
   * Approver: PENDING_APPROVER → CHANGES_REQUESTED (back to requester only).
   * Processor: APPROVED_APPROVER → PENDING_APPROVER (approver) or CHANGES_REQUESTED (requester).
   */
  async requestChanges(
    id: string,
    notes: string,
    target: 'requester' | 'approver',
    actingUser?: ActingUser,
  ): Promise<Expense> {
    const trimmedNotes = String(notes || '').trim();
    if (!trimmedNotes) {
      throw new BadRequestException('Notes are required when requesting changes.');
    }
    if (target !== 'requester' && target !== 'approver') {
      throw new BadRequestException('Target must be "requester" or "approver".');
    }

    const expense = await this.expenseModel.findOne({ id }).exec();
    if (!expense) throw new NotFoundException(`Expense with ID ${id} not found`);

    const role = actingUser?.role || '';
    const isApproverRole = role === 'APPROVER' || role === 'ADMIN';
    const isProcessorRole = role === 'PROCESSOR' || role === 'ADMIN';

    if (expense.status === 'PENDING_APPROVER') {
      if (!isApproverRole) {
        throw new ForbiddenException('Only approvers can request changes on pending requests.');
      }
      await this.assertApproverProjectAccess(expense, actingUser);
      if (target !== 'requester') {
        throw new BadRequestException('Approvers can only send requests back to the requester.');
      }
    } else if (expense.status === 'APPROVED_APPROVER') {
      if (!isProcessorRole) {
        throw new ForbiddenException('Only processors can request changes on approved requests.');
      }
      if (Number(expense.paidAmount || 0) > 0) {
        throw new BadRequestException(
          'Cannot request changes after a partial payment has been recorded.',
        );
      }
    } else {
      throw new BadRequestException(
        `Cannot request changes. Current status is ${expense.status}`,
      );
    }

    const now = new Date().toISOString();
    const userName = actingUser ? `${actingUser.name} (${actingUser.email})` : 'Staff';

    if (target === 'approver') {
      expense.status = 'PENDING_APPROVER';
      expense.approverNotes = undefined;
      expense.approvedAt = undefined;
      expense.processorNotes = undefined;
      expense.changeRequestNotes = trimmedNotes;
      expense.changeRequestedAt = now;
      expense.changeRequestedBy = userName;
      expense.history.push({
        action: 'Returned to Approver',
        timestamp: now,
        user: userName,
        notes: trimmedNotes,
      });
      const saved = await expense.save();
      await this.notifyApproversOfReturn(saved, trimmedNotes);
      return saved;
    }

    expense.status = 'CHANGES_REQUESTED';
    expense.changeRequestNotes = trimmedNotes;
    expense.changeRequestedAt = now;
    expense.changeRequestedBy = userName;
    expense.history.push({
      action: 'Requested Changes',
      timestamp: now,
      user: userName,
      notes: trimmedNotes,
    });
    const saved = await expense.save();
    this.notify(
      `changes-requested ${saved.id}`,
      this.mailService.sendExpenseChangesRequestedToRequester(
        this.toMailSummary(saved, trimmedNotes),
      ),
    );
    return saved;
  }

  private async notifyApproversOfReturn(expense: Expense | ExpenseDocument, notes: string) {
    const summary = this.toMailSummary(expense, notes);
    const approvers = await this.usersService.findActiveApproversForProject(expense.project);
    if (approvers.length === 0) {
      this.logger.warn(
        `No active APPROVER users assigned to project "${expense.project}" for returned expense ${expense.id}`,
      );
      return;
    }
    for (const approver of approvers) {
      this.notify(
        `returned→approver ${approver.email} ${expense.id}`,
        this.mailService.sendExpenseReturnedToApprover({
          to: approver.email,
          approverName: approver.name,
          expense: summary,
        }),
      );
    }
  }

  private assertPayableStatus(status: string, action: string) {
    if (status !== 'APPROVED_APPROVER' && status !== 'PARTIALLY_PAID') {
      throw new BadRequestException(`Cannot ${action} expense. Current status is ${status}`);
    }
  }

  private roundMoney(value: number): number {
    return Math.round(Number(value) * 100) / 100;
  }

  private remainingAmount(expense: ExpenseDocument): number {
    const paid = this.roundMoney(Number(expense.paidAmount || 0));
    return this.roundMoney(Math.max(0, Number(expense.amount) - paid));
  }

  /** Remaining USD still owed — used when naming full-pay receipts. */
  async getRemainingUsd(id: string): Promise<number> {
    const expense = await this.expenseModel.findOne({ id }).exec();
    if (!expense) throw new NotFoundException(`Expense with ID ${id} not found`);
    const remaining = this.remainingAmount(expense);
    return remaining > 0 ? remaining : this.roundMoney(Number(expense.amount));
  }

  async process(
    id: string,
    notes?: string,
    actingUser?: ActingUser,
    receipt?: PaymentReceiptUploadMeta,
  ): Promise<Expense> {
    if (!receipt?.fileName) {
      throw new BadRequestException('Payment receipt attachment is required.');
    }

    const expense = await this.expenseModel.findOne({ id }).exec();
    if (!expense) {
      await this.removeReceiptFile(receipt.fileName);
      throw new NotFoundException(`Expense with ID ${id} not found`);
    }
    try {
      this.assertPayableStatus(expense.status, 'process');
    } catch (err) {
      await this.removeReceiptFile(receipt.fileName);
      throw err;
    }

    const now = new Date().toISOString();
    const userName = actingUser ? `${actingUser.name} (${actingUser.email})` : 'Processor';
    const remaining = this.remainingAmount(expense);
    const payAmount = remaining > 0 ? remaining : this.roundMoney(Number(expense.amount));
    expense.paidAmount = this.roundMoney(Number(expense.amount));
    expense.status = 'PROCESSED';
    expense.processorNotes = notes;
    expense.processedAt = now;
    this.pushPaymentReceipt(expense, receipt, actingUser, payAmount);
    expense.history.push({
      action: 'Processed & Paid',
      timestamp: now,
      user: userName,
      notes:
        (notes || (remaining > 0 ? 'Marked as fully paid.' : 'Marked as processed.')) +
        ` Receipt: ${receipt.originalName}.`,
      paymentAmount: payAmount,
      totalPaid: this.roundMoney(Number(expense.amount)),
      remaining: 0,
    });
    const saved = await expense.save();
    this.notify(
      `fully-paid ${saved.id}`,
      this.mailService.sendExpenseFullyPaidToRequester(this.toMailSummary(saved, notes)),
    );
    return saved;
  }

  async partialPay(
    id: string,
    paymentAmount: number,
    notes?: string,
    actingUser?: ActingUser,
    receipt?: PaymentReceiptUploadMeta,
  ): Promise<Expense> {
    if (!receipt?.fileName) {
      throw new BadRequestException('Payment receipt attachment is required.');
    }

    const expense = await this.expenseModel.findOne({ id }).exec();
    if (!expense) {
      await this.removeReceiptFile(receipt.fileName);
      throw new NotFoundException(`Expense with ID ${id} not found`);
    }

    try {
      this.assertPayableStatus(expense.status, 'partially pay');

      const amount = this.roundMoney(Number(paymentAmount));
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BadRequestException('Payment amount must be greater than $0.00');
      }

      const remaining = this.remainingAmount(expense);
      if (amount > remaining) {
        throw new BadRequestException(
          `Payment amount cannot exceed remaining balance of $${remaining.toFixed(2)}`,
        );
      }

      const now = new Date().toISOString();
      const userName = actingUser ? `${actingUser.name} (${actingUser.email})` : 'Processor';
      const newPaid = this.roundMoney(Number(expense.paidAmount || 0) + amount);
      expense.paidAmount = newPaid;
      expense.processorNotes = notes ?? expense.processorNotes;
      this.pushPaymentReceipt(expense, receipt, actingUser, amount);

      const newRemaining = this.roundMoney(Number(expense.amount) - newPaid);
      let becameFullyPaid = false;
      if (newRemaining <= 0) {
        expense.paidAmount = this.roundMoney(Number(expense.amount));
        expense.status = 'PROCESSED';
        expense.processedAt = now;
        becameFullyPaid = true;
        expense.history.push({
          action: 'Processed & Paid',
          timestamp: now,
          user: userName,
          notes: (notes || 'Final payment — request fully paid.') + ` Receipt: ${receipt.originalName}.`,
          paymentAmount: amount,
          totalPaid: this.roundMoney(Number(expense.amount)),
          remaining: 0,
        });
      } else {
        expense.status = 'PARTIALLY_PAID';
        expense.history.push({
          action: 'Partially Paid',
          timestamp: now,
          user: userName,
          notes: (notes ? `${notes} ` : '') + `Receipt: ${receipt.originalName}.`,
          paymentAmount: amount,
          totalPaid: newPaid,
          remaining: newRemaining,
        });
      }

      const saved = await expense.save();
      if (becameFullyPaid) {
        this.notify(
          `fully-paid (partial final) ${saved.id}`,
          this.mailService.sendExpenseFullyPaidToRequester(this.toMailSummary(saved, notes)),
        );
      }
      return saved;
    } catch (err) {
      await this.removeReceiptFile(receipt.fileName);
      throw err;
    }
  }

  async processorReject(id: string, notes?: string, actingUser?: ActingUser): Promise<Expense> {
    const expense = await this.expenseModel.findOne({ id }).exec();
    if (!expense) throw new NotFoundException(`Expense with ID ${id} not found`);
    this.assertPayableStatus(expense.status, 'reject');

    const now = new Date().toISOString();
    const userName = actingUser ? `${actingUser.name} (${actingUser.email})` : 'Processor';
    expense.status = 'REJECTED_PROCESSOR';
    expense.processorNotes = notes;
    expense.processedAt = now;
    expense.history.push({
      action: 'Rejected by Finance Officer',
      timestamp: now,
      user: userName,
      notes: notes || 'Rejected without notes.',
    });
    const saved = await expense.save();
    this.notify(
      `rejected-by-processor ${saved.id}`,
      this.mailService.sendExpenseRejectedByProcessor(this.toMailSummary(saved, notes)),
    );
    return saved;
  }

  private assertCanMutateExpenseDetails(
    expense: ExpenseDocument,
    actingUser: ActingUser | undefined,
    action: string,
  ) {
    if (!actingUser) {
      throw new ForbiddenException(`You must be signed in to ${action} this expense`);
    }

    // Approver / Processor send requests back via Request Changes — they do not edit the form
    if (actingUser.role === 'APPROVER' || actingUser.role === 'PROCESSOR') {
      throw new ForbiddenException(
        `Approvers and processors cannot ${action} expense details. Use Request Changes instead.`,
      );
    }

    if (actingUser.role === 'REQUESTER') {
      if (expense.requesterEmail.toLowerCase() !== actingUser.email.toLowerCase()) {
        throw new ForbiddenException(`You can only ${action} your own expense requests`);
      }
      if (action === 'edit') {
        // Edit only after Approver/Processor Request Changes
        if (expense.status !== 'CHANGES_REQUESTED') {
          throw new BadRequestException(
            'You can only edit a request after staff has requested changes.',
          );
        }
        return;
      }
      throw new ForbiddenException(`Requesters cannot ${action} expense requests.`);
    }

    // ADMIN may correct details only when requester would be allowed to edit
    if (actingUser.role === 'ADMIN') {
      if (action === 'edit' && expense.status !== 'CHANGES_REQUESTED') {
        throw new BadRequestException(
          'Expense details can only be edited when status is Changes Requested.',
        );
      }
      if (
        action === 'delete' &&
        expense.status !== 'PENDING_APPROVER' &&
        expense.status !== 'CHANGES_REQUESTED'
      ) {
        throw new BadRequestException(
          `Cannot ${action} this expense after it has been approved, paid, or rejected`,
        );
      }
      return;
    }

    throw new ForbiddenException(`You are not allowed to ${action} this expense`);
  }

  async update(
    id: string,
    updateData: {
      requesterName?: string;
      requesterEmail?: string;
      originalAmount?: number;
      country?: string;
      category?: string;
      project?: string;
      description?: string;
      date?: string;
      dueDate?: string;
      invoiceNumber?: string;
      invoiceDate?: string;
    },
    actingUser?: ActingUser,
  ): Promise<Expense> {
    const expense = await this.expenseModel.findOne({ id }).exec();
    if (!expense) throw new NotFoundException(`Expense with ID ${id} not found`);
    this.assertCanMutateExpenseDetails(expense, actingUser, 'edit');

    const wasChangesRequested = expense.status === 'CHANGES_REQUESTED';
    const now = new Date().toISOString();
    const changes: string[] = [];

    if (updateData.requesterName && updateData.requesterName !== expense.requesterName) {
      changes.push(`Name: "${expense.requesterName}" ➔ "${updateData.requesterName}"`);
      expense.requesterName = updateData.requesterName;
    }
    if (
      actingUser?.role !== 'REQUESTER' &&
      updateData.requesterEmail &&
      updateData.requesterEmail !== expense.requesterEmail
    ) {
      changes.push(`Email: "${expense.requesterEmail}" ➔ "${updateData.requesterEmail}"`);
      expense.requesterEmail = updateData.requesterEmail;
    }
    if (updateData.category && updateData.category !== expense.category) {
      const category = await this.categoriesService.assertActiveName(updateData.category);
      changes.push(`Category: "${expense.category}" ➔ "${category}"`);
      expense.category = category;
    }
    if (updateData.project && updateData.project !== expense.project) {
      const project = await this.projectsService.assertActiveName(updateData.project);
      if (actingUser?.role === 'REQUESTER') {
        const user = await this.usersService.findById(actingUser.userId);
        if (!user || !this.usersService.userHasProjectAccess(user, project)) {
          throw new ForbiddenException(
            `You are not assigned to project "${project}". Contact an administrator.`,
          );
        }
      }
      changes.push(`Project: "${expense.project || '—'}" ➔ "${project}"`);
      expense.project = project;
    }
    if (updateData.description && updateData.description !== expense.description) {
      changes.push(`Description updated`);
      expense.description = updateData.description;
    }
    if (updateData.date && updateData.date !== expense.date) {
      changes.push(`Date: "${expense.date}" ➔ "${updateData.date}"`);
      expense.date = updateData.date;
    }
    if (updateData.dueDate && updateData.dueDate !== expense.dueDate) {
      changes.push(`Due date: "${expense.dueDate || '—'}" ➔ "${updateData.dueDate}"`);
      expense.dueDate = updateData.dueDate;
    }
    if (updateData.invoiceNumber !== undefined) {
      const nextInvoiceNumber = updateData.invoiceNumber.trim();
      const prevInvoiceNumber = expense.invoiceNumber || '';
      if (nextInvoiceNumber !== prevInvoiceNumber) {
        changes.push(
          `Invoice number: "${prevInvoiceNumber || '—'}" ➔ "${nextInvoiceNumber || '—'}"`,
        );
        expense.invoiceNumber = nextInvoiceNumber || undefined;
      }
    }
    if (updateData.invoiceDate !== undefined) {
      const nextInvoiceDate = updateData.invoiceDate.trim();
      const prevInvoiceDate = expense.invoiceDate || '';
      if (nextInvoiceDate !== prevInvoiceDate) {
        changes.push(
          `Invoice date: "${prevInvoiceDate || '—'}" ➔ "${nextInvoiceDate || '—'}"`,
        );
        expense.invoiceDate = nextInvoiceDate || undefined;
      }
    }

    const effectiveDate = expense.date;
    const effectiveDueDate = expense.dueDate;
    if (effectiveDueDate && effectiveDate && effectiveDueDate < effectiveDate) {
      throw new BadRequestException('Due date cannot be before the expense date');
    }

    const countryChanged =
      updateData.country !== undefined && updateData.country !== expense.country;
    const amountChanged =
      updateData.originalAmount !== undefined &&
      Number(updateData.originalAmount) !== Number(expense.originalAmount || expense.amount);

    if (countryChanged || amountChanged) {
      const countryName = updateData.country ?? expense.country;
      if (!countryName) {
        throw new BadRequestException('Country is required to update amount');
      }
      const country = await this.countriesService.assertActiveCountry(countryName);
      const localAmount = Number(
        updateData.originalAmount ?? expense.originalAmount ?? expense.amount,
      );
      const fx = await this.fxService.convertToUsd(country.currency, localAmount);
      changes.push(
        `Amount: ${expense.originalAmount || expense.amount} ${expense.currency || 'USD'} ➔ ${fx.originalAmount} ${fx.currency} (≈ $${fx.amountUsd})`,
      );
      expense.country = country.name;
      expense.currency = fx.currency;
      expense.originalAmount = fx.originalAmount;
      expense.exchangeRate = fx.exchangeRate;
      expense.exchangeRateDate = fx.rateDate;
      expense.amount = fx.amountUsd;
    }

    const userName = actingUser ? `${actingUser.name} (${actingUser.email})` : 'Dashboard User';

    if (changes.length > 0) {
      expense.history.push({
        action: 'Request Details Modified',
        timestamp: now,
        user: userName,
        notes: `Modified: ${changes.join(', ')}`,
      });
    }

    if (wasChangesRequested) {
      expense.status = 'PENDING_APPROVER';
      // Keep changeRequestNotes for audit in tracker/report; history also retains them.
      expense.history.push({
        action: 'Resubmitted after Changes',
        timestamp: now,
        user: userName,
        notes:
          changes.length > 0
            ? 'Requester updated the request and resubmitted for approval.'
            : 'Requester resubmitted the request for approval.',
      });
      const saved = await expense.save();
      await this.notifyApproversOfSubmission(saved);
      return saved;
    }

    if (changes.length > 0) {
      return expense.save();
    }

    return expense.toObject() as Expense;
  }

  async delete(id: string, actingUser?: ActingUser): Promise<void> {
    const expense = await this.expenseModel.findOne({ id }).exec();
    if (!expense) throw new NotFoundException(`Expense with ID ${id} not found`);

    if (actingUser?.role === 'REQUESTER') {
      throw new ForbiddenException('Requesters cannot delete expense requests.');
    }

    const result = await this.expenseModel.deleteOne({ id }).exec();
    if (result.deletedCount === 0) throw new NotFoundException(`Expense with ID ${id} not found`);
    await this.removeInvoiceFile(expense.invoiceFileName);
    for (const receipt of expense.paymentReceipts || []) {
      await this.removeReceiptFile(receipt.fileName);
    }
  }

  async getInvoiceFile(id: string): Promise<{
    buffer: Buffer;
    originalName: string;
    mimeType: string;
  }> {
    const expense = await this.expenseModel.findOne({ id }).lean().exec();
    if (!expense) throw new NotFoundException(`Expense with ID ${id} not found`);
    if (!expense.invoiceFileName) {
      throw new NotFoundException('No invoice attached to this expense.');
    }

    try {
      const file = await this.storageService.readAttachment('invoices', expense.invoiceFileName);
      return {
        buffer: file.buffer,
        originalName: expense.invoiceOriginalName || expense.invoiceFileName,
        mimeType: expense.invoiceMimeType || 'application/octet-stream',
      };
    } catch {
      throw new NotFoundException('Invoice file is missing in storage.');
    }
  }

  async getPaymentReceiptFile(
    id: string,
    fileName: string,
  ): Promise<{
    buffer: Buffer;
    originalName: string;
    mimeType: string;
  }> {
    const expense = await this.expenseModel.findOne({ id }).lean().exec();
    if (!expense) throw new NotFoundException(`Expense with ID ${id} not found`);

    const receipt = (expense.paymentReceipts || []).find((r) => r.fileName === fileName);
    if (!receipt) {
      throw new NotFoundException('Payment receipt not found on this expense.');
    }

    try {
      const file = await this.storageService.readAttachment('receipts', receipt.fileName);
      return {
        buffer: file.buffer,
        originalName: receipt.originalName || receipt.fileName,
        mimeType: receipt.mimeType || 'application/octet-stream',
      };
    } catch {
      throw new NotFoundException('Payment receipt file is missing in storage.');
    }
  }

  async getStats(): Promise<any> {
    const expenses = await this.expenseModel.find().lean().exec();
    let totalRequested = 0, totalProcessed = 0, pendingApproval = 0;
    let pendingProcessing = 0, processed = 0, rejected = 0;
    const byCategory: { [key: string]: number } = {};

    expenses.forEach((e) => {
      totalRequested += e.amount;
      const paid = Number(e.paidAmount || 0);
      if (e.status === 'PENDING_APPROVER') pendingApproval++;
      else if (e.status === 'APPROVED_APPROVER' || e.status === 'PARTIALLY_PAID') {
        pendingProcessing++;
      } else if (e.status === 'PROCESSED') {
        processed++;
        totalProcessed += paid > 0 ? paid : e.amount;
      } else if (e.status === 'REJECTED_APPROVER' || e.status === 'REJECTED_PROCESSOR') {
        rejected++;
      }
      if (e.status === 'PARTIALLY_PAID' && paid > 0) {
        totalProcessed += paid;
      }
      if (!byCategory[e.category]) byCategory[e.category] = 0;
      byCategory[e.category] += e.amount;
    });

    const allLogs: any[] = [];
    expenses.forEach((e) => {
      e.history.forEach((h) => {
        allLogs.push({ expenseId: e.id, requesterName: e.requesterName, action: h.action, timestamp: h.timestamp, user: h.user });
      });
    });

    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      totalRequests: expenses.length,
      pendingApproval,
      pendingProcessing,
      processed,
      rejected,
      totalRequestedAmount: totalRequested,
      totalProcessedAmount: totalProcessed,
      byCategory,
      recentActivity: allLogs.slice(0, 20),
    };
  }

  private localDateOnly(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * Email all active approvers for requests due in 3 or 1 days.
   * Each reminder type is sent once per expense.
   */
  async sendApproverDueSoonReminders(
    daysLeft: 1 | 3 = 1,
  ): Promise<{ checked: number; reminded: number }> {
    const dueDate = new Date();
    dueDate.setHours(0, 0, 0, 0);
    dueDate.setDate(dueDate.getDate() + daysLeft);
    const dueDateStr = this.localDateOnly(dueDate);
    const reminderField =
      daysLeft === 3
        ? 'approverThreeDayReminderSentOn'
        : 'approverDueSoonReminderSentOn';

    const pending = await this.expenseModel
      .find({
        status: 'PENDING_APPROVER',
        $or: [
          { dueDate: dueDateStr },
          { dueDate: { $regex: `^${dueDateStr}` } },
        ],
      })
      .exec();

    const candidates = pending.filter(
      (e) => e[reminderField] !== dueDateStr,
    );

    if (candidates.length === 0) {
      return { checked: pending.length, reminded: 0 };
    }

    const approvers = await this.usersService.findActiveByRole('APPROVER');
    if (approvers.length === 0) {
      this.logger.warn('Due-soon reminder skipped: no active APPROVER users.');
      return { checked: candidates.length, reminded: 0 };
    }

    let reminded = 0;
    for (const expense of candidates) {
      const summary = this.toMailSummary(expense);
      const matching = approvers.filter((a) =>
        a.assignedProjects.includes(expense.project),
      );
      if (matching.length === 0) {
        this.logger.warn(
          `Due-soon skipped for ${expense.id}: no approver assigned to "${expense.project}"`,
        );
        continue;
      }
      for (const approver of matching) {
        this.notify(
          `due-soon→approver ${approver.email} ${expense.id}`,
          this.mailService.sendExpenseDueSoonToApprover({
            to: approver.email,
            approverName: approver.name,
            expense: summary,
            daysLeft,
          }),
        );
      }
      expense[reminderField] = dueDateStr;
      await expense.save();
      reminded++;
    }

    this.logger.log(
      `Approver ${daysLeft}-day reminders: ${reminded} expense(s) for due date ${dueDateStr}`,
    );
    return { checked: candidates.length, reminded };
  }

  /**
   * Email processors for approved / partially paid requests due in 3 or 1
   * days. Each reminder type is sent once per expense.
   */
  async sendProcessorDueSoonReminders(
    daysLeft: 1 | 3 = 1,
  ): Promise<{ checked: number; reminded: number }> {
    const dueDate = new Date();
    dueDate.setHours(0, 0, 0, 0);
    dueDate.setDate(dueDate.getDate() + daysLeft);
    const dueDateStr = this.localDateOnly(dueDate);
    const reminderField =
      daysLeft === 3
        ? 'processorThreeDayReminderSentOn'
        : 'processorDueSoonReminderSentOn';

    const pendingPay = await this.expenseModel
      .find({
        status: { $in: ['APPROVED_APPROVER', 'PARTIALLY_PAID'] },
        $or: [
          { dueDate: dueDateStr },
          { dueDate: { $regex: `^${dueDateStr}` } },
        ],
      })
      .exec();

    const candidates = pendingPay.filter(
      (e) => e[reminderField] !== dueDateStr,
    );

    if (candidates.length === 0) {
      return { checked: pendingPay.length, reminded: 0 };
    }

    const processors = await this.usersService.findActiveByRole('PROCESSOR');
    if (processors.length === 0) {
      this.logger.warn('Processor due-soon reminder skipped: no active PROCESSOR users.');
      return { checked: candidates.length, reminded: 0 };
    }

    let reminded = 0;
    for (const expense of candidates) {
      const summary = this.toMailSummary(expense);
      for (const processor of processors) {
        this.notify(
          `due-soon→processor ${processor.email} ${expense.id}`,
          this.mailService.sendExpenseDueSoonToProcessor({
            to: processor.email,
            processorName: processor.name,
            expense: summary,
            daysLeft,
          }),
        );
      }
      expense[reminderField] = dueDateStr;
      await expense.save();
      reminded++;
    }

    this.logger.log(
      `Processor ${daysLeft}-day reminders: ${reminded} expense(s) for due date ${dueDateStr}`,
    );
    return { checked: candidates.length, reminded };
  }
}
