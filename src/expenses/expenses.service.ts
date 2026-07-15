import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Expense, ExpenseDocument } from './expense.schema';
import { CategoriesService } from '../categories/categories.service';
import { ProjectsService } from '../projects/projects.service';

export interface ActingUser {
  userId: string;
  name: string;
  email: string;
  role: string;
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
    private readonly categoriesService: CategoriesService,
    private readonly projectsService: ProjectsService,
  ) {}

  async create(
    expenseData: Omit<Expense, 'id' | 'status' | 'submittedAt' | 'history'>,
  ): Promise<Expense> {
    const category = await this.categoriesService.assertActiveName(expenseData.category);
    const project = await this.projectsService.assertActiveName(expenseData.project);

    const now = new Date().toISOString();
    const id = `EXP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newExpense = new this.expenseModel({
      ...expenseData,
      category,
      project,
      id,
      amount: Number(expenseData.amount),
      status: 'PENDING_APPROVER',
      submittedAt: now,
      history: [
        {
          action: 'Submitted Request',
          timestamp: now,
          user: 'Public Requester',
          notes: `Expense request of $${expenseData.amount} submitted by ${expenseData.requesterName}.`,
        },
      ],
    });

    return newExpense.save();
  }

  async findAll(): Promise<Expense[]> {
    return this.expenseModel.find().sort({ submittedAt: -1 }).lean().exec();
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
      notes: notes || 'Rejected without notes.',
    });
    return expense.save();
  }

  async process(id: string, notes?: string, actingUser?: ActingUser): Promise<Expense> {
    const expense = await this.expenseModel.findOne({ id }).exec();
    if (!expense) throw new NotFoundException(`Expense with ID ${id} not found`);
    if (expense.status !== 'APPROVED_APPROVER') {
      throw new BadRequestException(`Cannot process expense. Must be approved by Manager first.`);
    }

    const now = new Date().toISOString();
    const userName = actingUser ? `${actingUser.name} (${actingUser.email})` : 'Processor';
    expense.status = 'PROCESSED';
    expense.processorNotes = notes;
    expense.processedAt = now;
    expense.history.push({
      action: 'Processed & Paid',
      timestamp: now,
      user: userName,
      notes: notes || 'Processed and disbursed without notes.',
    });
    return expense.save();
  }

  async processorReject(id: string, notes?: string, actingUser?: ActingUser): Promise<Expense> {
    const expense = await this.expenseModel.findOne({ id }).exec();
    if (!expense) throw new NotFoundException(`Expense with ID ${id} not found`);
    if (expense.status !== 'APPROVED_APPROVER') {
      throw new BadRequestException(`Cannot reject. Must be approved by Manager first.`);
    }

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

  async update(
    id: string,
    updateData: {
      requesterName?: string;
      requesterEmail?: string;
      amount?: number;
      category?: string;
      project?: string;
      description?: string;
      date?: string;
    },
    actingUser?: ActingUser,
  ): Promise<Expense> {
    const expense = await this.expenseModel.findOne({ id }).exec();
    if (!expense) throw new NotFoundException(`Expense with ID ${id} not found`);

    const now = new Date().toISOString();
    const changes: string[] = [];

    if (updateData.requesterName && updateData.requesterName !== expense.requesterName) {
      changes.push(`Name: "${expense.requesterName}" ➔ "${updateData.requesterName}"`);
      expense.requesterName = updateData.requesterName;
    }
    if (updateData.requesterEmail && updateData.requesterEmail !== expense.requesterEmail) {
      changes.push(`Email: "${expense.requesterEmail}" ➔ "${updateData.requesterEmail}"`);
      expense.requesterEmail = updateData.requesterEmail;
    }
    if (updateData.amount && Number(updateData.amount) !== expense.amount) {
      changes.push(`Amount: $${expense.amount} ➔ $${updateData.amount}`);
      expense.amount = Number(updateData.amount);
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

  async delete(id: string): Promise<void> {
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
      if (e.status === 'PENDING_APPROVER') pendingApproval++;
      else if (e.status === 'APPROVED_APPROVER') pendingProcessing++;
      else if (e.status === 'PROCESSED') { processed++; totalProcessed += e.amount; }
      else if (e.status === 'REJECTED_APPROVER' || e.status === 'REJECTED_PROCESSOR') rejected++;
      if (!byCategory[e.category]) byCategory[e.category] = 0;
      byCategory[e.category] += e.amount;
    });

    const allLogs: any[] = [];
    expenses.forEach((e) => {
      e.history.forEach((h) => {
        allLogs.push({ expenseId: e.id, requesterName: e.requesterName, action: h.action, timestamp: h.timestamp, user: h.user });
      });
    });
    const recentActivity = allLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);

    return { totalRequests: expenses.length, pendingApproval, pendingProcessing, processed, rejected, totalRequestedAmount: totalRequested, totalProcessedAmount: totalProcessed, byCategory, recentActivity };
  }
}
