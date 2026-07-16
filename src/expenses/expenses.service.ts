import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Expense, ExpenseDocument } from './expense.schema';
import { CategoriesService } from '../categories/categories.service';
import { ProjectsService } from '../projects/projects.service';
import { CountriesService } from '../countries/countries.service';
import { FxService } from '../fx/fx.service';

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
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
    private readonly categoriesService: CategoriesService,
    private readonly projectsService: ProjectsService,
    private readonly countriesService: CountriesService,
    private readonly fxService: FxService,
  ) {}

  async create(expenseData: CreateExpenseInput): Promise<Expense> {
    const category = await this.categoriesService.assertActiveName(expenseData.category);
    const project = await this.projectsService.assertActiveName(expenseData.project);
    const country = await this.countriesService.assertActiveCountry(expenseData.country);

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
    const id = `EXP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newExpense = new this.expenseModel({
      requesterName: expenseData.requesterName,
      requesterEmail: expenseData.requesterEmail.trim().toLowerCase(),
      description: expenseData.description,
      date: expenseData.date,
      dueDate: expenseData.dueDate,
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
      history: [
        {
          action: 'Submitted Request',
          timestamp: now,
          user: 'Public Requester',
          notes: `Expense of ${fx.originalAmount} ${fx.currency} (≈ $${fx.amountUsd} USD @ ${fx.exchangeRate}) submitted by ${expenseData.requesterName}.`,
        },
      ],
    });

    return newExpense.save();
  }

  async findAll(): Promise<Expense[]> {
    return this.expenseModel.find().sort({ submittedAt: -1 }).lean().exec();
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
    return expense.save();
  }

  async reject(id: string, notes?: string, actingUser?: ActingUser): Promise<Expense> {
    const expense = await this.expenseModel.findOne({ id }).exec();
    if (!expense) throw new NotFoundException(`Expense with ID ${id} not found`);
    if (expense.status !== 'PENDING_APPROVER') {
      throw new BadRequestException(`Cannot reject expense. Current status is ${expense.status}`);
    }

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
    return expense.save();
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

  async process(id: string, notes?: string, actingUser?: ActingUser): Promise<Expense> {
    const expense = await this.expenseModel.findOne({ id }).exec();
    if (!expense) throw new NotFoundException(`Expense with ID ${id} not found`);
    this.assertPayableStatus(expense.status, 'process');

    const now = new Date().toISOString();
    const userName = actingUser ? `${actingUser.name} (${actingUser.email})` : 'Processor';
    const remaining = this.remainingAmount(expense);
    expense.paidAmount = this.roundMoney(Number(expense.amount));
    expense.status = 'PROCESSED';
    expense.processorNotes = notes;
    expense.processedAt = now;
    expense.history.push({
      action: 'Processed & Paid',
      timestamp: now,
      user: userName,
      notes:
        notes ||
        (remaining > 0
          ? `Marked as fully paid. Final payout $${remaining.toFixed(2)}.`
          : 'Marked as processed.'),
    });
    return expense.save();
  }

  async partialPay(
    id: string,
    paymentAmount: number,
    notes?: string,
    actingUser?: ActingUser,
  ): Promise<Expense> {
    const expense = await this.expenseModel.findOne({ id }).exec();
    if (!expense) throw new NotFoundException(`Expense with ID ${id} not found`);
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

    const newRemaining = this.roundMoney(Number(expense.amount) - newPaid);
    if (newRemaining <= 0) {
      expense.paidAmount = this.roundMoney(Number(expense.amount));
      expense.status = 'PROCESSED';
      expense.processedAt = now;
      expense.history.push({
        action: 'Processed & Paid',
        timestamp: now,
        user: userName,
        notes:
          notes ||
          `Final partial payment of $${amount.toFixed(2)}. Fully paid $${expense.paidAmount.toFixed(2)}.`,
      });
    } else {
      expense.status = 'PARTIALLY_PAID';
      expense.history.push({
        action: 'Partially Paid',
        timestamp: now,
        user: userName,
        notes:
          notes ||
          `Partial payment of $${amount.toFixed(2)}. Paid $${newPaid.toFixed(2)} of $${Number(expense.amount).toFixed(2)}. Remaining $${newRemaining.toFixed(2)}.`,
      });
    }

    return expense.save();
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
    return expense.save();
  }

  private assertRequesterCanMutate(
    expense: ExpenseDocument,
    actingUser: ActingUser | undefined,
    action: string,
  ) {
    if (!actingUser || actingUser.role !== 'REQUESTER') return;
    if (expense.requesterEmail.toLowerCase() !== actingUser.email.toLowerCase()) {
      throw new ForbiddenException(`You can only ${action} your own expense requests`);
    }
    if (expense.status !== 'PENDING_APPROVER') {
      throw new BadRequestException(
        `You can only ${action} requests that are still awaiting manager approval`,
      );
    }
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
    },
    actingUser?: ActingUser,
  ): Promise<Expense> {
    const expense = await this.expenseModel.findOne({ id }).exec();
    if (!expense) throw new NotFoundException(`Expense with ID ${id} not found`);
    this.assertRequesterCanMutate(expense, actingUser, 'edit');

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

    if (changes.length > 0) {
      const userName = actingUser ? `${actingUser.name} (${actingUser.email})` : 'Dashboard User';
      expense.history.push({
        action: 'Request Details Modified',
        timestamp: now,
        user: userName,
        notes: `Modified: ${changes.join(', ')}`,
      });
      return expense.save();
    }

    return expense.toObject() as Expense;
  }

  async delete(id: string, actingUser?: ActingUser): Promise<void> {
    const expense = await this.expenseModel.findOne({ id }).exec();
    if (!expense) throw new NotFoundException(`Expense with ID ${id} not found`);
    this.assertRequesterCanMutate(expense, actingUser, 'delete');

    const result = await this.expenseModel.deleteOne({ id }).exec();
    if (result.deletedCount === 0) throw new NotFoundException(`Expense with ID ${id} not found`);
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
}
