import {
  Controller, Get, Post, Patch, Put, Delete,
  Body, Param, Query, UseGuards, Request,
  UseInterceptors, UploadedFile, BadRequestException,
  StreamableFile, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Readable } from 'stream';
import { ExpensesService } from './expenses.service';
import { attachmentMulterOptions } from './attachment-upload';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('expenses')
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly storageService: StorageService,
  ) {}

  // Public — multipart form with required invoice file
  @Post()
  @UseInterceptors(FileInterceptor('invoice', attachmentMulterOptions('invoice')))
  async create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body()
    body: {
      requesterName: string;
      requesterEmail: string;
      originalAmount: string | number;
      country: string;
      category: string;
      project: string;
      description: string;
      date: string;
      dueDate: string;
      invoiceNumber?: string;
      invoiceDate?: string;
    },
  ) {
    if (!file) {
      throw new BadRequestException('Invoice attachment is required.');
    }

    const expenseId = this.expensesService.generateExpenseId();
    const stored = await this.storageService.saveAttachment('invoices', file, {
      expenseId,
      kind: 'invoice',
    });

    return this.expensesService.create(
      {
        requesterName: body.requesterName,
        requesterEmail: body.requesterEmail,
        originalAmount: Number(body.originalAmount),
        country: body.country,
        category: body.category,
        project: body.project,
        description: body.description,
        date: body.date,
        dueDate: body.dueDate,
        invoiceNumber: body.invoiceNumber?.trim() || undefined,
        invoiceDate: body.invoiceDate || undefined,
        id: expenseId,
      },
      {
        fileName: stored.fileName,
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        size: stored.size,
      },
    );
  }

  // Protected — role-aware list (Approvers only see assigned projects)
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Request() req: any, @Query('email') email?: string) {
    const expenses = await this.expensesService.findAllForUser({
      userId: req.user.userId,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    });
    if (email) {
      return expenses.filter((e) => e.requesterEmail.toLowerCase() === email.toLowerCase());
    }
    return expenses;
  }

  // Protected — dashboard stats
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats() {
    return this.expensesService.getStats();
  }

  // Protected — logged-in user's own expenses only
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  async findMine(@Request() req: any) {
    return this.expensesService.findMine(req.user.email);
  }

  // Protected — download / view invoice attachment
  @Get(':id/invoice')
  @UseGuards(JwtAuthGuard)
  async getInvoice(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const invoice = await this.expensesService.getInvoiceFile(id);
    res.set({
      'Content-Type': invoice.mimeType,
      'Content-Disposition': `inline; filename="${invoice.originalName.replace(/"/g, '')}"`,
    });
    return new StreamableFile(Readable.from(invoice.buffer));
  }

  // Protected — download / view a payment receipt
  @Get(':id/payment-receipt/:fileName')
  @UseGuards(JwtAuthGuard)
  async getPaymentReceipt(
    @Param('id') id: string,
    @Param('fileName') fileName: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const receipt = await this.expensesService.getPaymentReceiptFile(id, fileName);
    res.set({
      'Content-Type': receipt.mimeType,
      'Content-Disposition': `inline; filename="${receipt.originalName.replace(/"/g, '')}"`,
    });
    return new StreamableFile(Readable.from(receipt.buffer));
  }

  // Public — allow status tracking by ID
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.expensesService.findOne(id);
  }

  // APPROVER or ADMIN only
  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('APPROVER', 'ADMIN')
  async approve(@Param('id') id: string, @Body('notes') notes: string, @Request() req: any) {
    return this.expensesService.approve(id, notes, req.user);
  }

  // APPROVER or ADMIN only
  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('APPROVER', 'ADMIN')
  async reject(@Param('id') id: string, @Body('notes') notes: string, @Request() req: any) {
    return this.expensesService.reject(id, notes, req.user);
  }

  // APPROVER / PROCESSOR / ADMIN — return for changes (requester) or undo approval (approver)
  @Patch(':id/request-changes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('APPROVER', 'PROCESSOR', 'ADMIN')
  async requestChanges(
    @Param('id') id: string,
    @Body() body: { notes?: string; target?: 'requester' | 'approver' },
    @Request() req: any,
  ) {
    return this.expensesService.requestChanges(
      id,
      body.notes || '',
      body.target || 'requester',
      req.user,
    );
  }

  // PROCESSOR or ADMIN only — mark fully paid (receipt required)
  @Patch(':id/process')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROCESSOR', 'ADMIN')
  @UseInterceptors(FileInterceptor('receipt', attachmentMulterOptions('receipt')))
  async process(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { notes?: string },
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Payment receipt attachment is required.');
    }
    const paymentAmountUsd = await this.expensesService.getRemainingUsd(id);
    const stored = await this.storageService.saveAttachment('receipts', file, {
      expenseId: id,
      kind: 'receipt',
      paymentAmountUsd,
    });
    return this.expensesService.process(id, body.notes, req.user, {
      fileName: stored.fileName,
      originalName: stored.originalName,
      mimeType: stored.mimeType,
      size: stored.size,
    });
  }

  // PROCESSOR or ADMIN only — partial payout (receipt required)
  @Patch(':id/partial-pay')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROCESSOR', 'ADMIN')
  @UseInterceptors(FileInterceptor('receipt', attachmentMulterOptions('receipt')))
  async partialPay(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { amount: string | number; notes?: string },
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Payment receipt attachment is required.');
    }
    const paymentAmountUsd = Number(body.amount);
    const stored = await this.storageService.saveAttachment('receipts', file, {
      expenseId: id,
      kind: 'receipt',
      paymentAmountUsd,
    });
    return this.expensesService.partialPay(
      id,
      paymentAmountUsd,
      body.notes,
      req.user,
      {
        fileName: stored.fileName,
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        size: stored.size,
      },
    );
  }

  // PROCESSOR or ADMIN only
  @Patch(':id/processor-reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROCESSOR', 'ADMIN')
  async processorReject(@Param('id') id: string, @Body('notes') notes: string, @Request() req: any) {
    return this.expensesService.processorReject(id, notes, req.user);
  }

  // REQUESTER (own pending / changes-requested) or ADMIN — JSON field update
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'REQUESTER')
  async update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const data = body ?? {};
    return this.expensesService.update(
      id,
      {
        requesterName: data.requesterName,
        requesterEmail: data.requesterEmail,
        originalAmount:
          data.originalAmount !== undefined && data.originalAmount !== ''
            ? Number(data.originalAmount)
            : undefined,
        country: data.country,
        category: data.category,
        project: data.project,
        description: data.description,
        date: data.date,
        dueDate: data.dueDate,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate,
      },
      req.user,
    );
  }

  // Optional invoice replace during edit/resubmit
  @Patch(':id/invoice')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'REQUESTER')
  @UseInterceptors(FileInterceptor('invoice', attachmentMulterOptions('invoice')))
  async replaceInvoice(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Invoice attachment is required.');
    }
    const stored = await this.storageService.saveAttachment('invoices', file, {
      expenseId: id,
      kind: 'invoice',
    });
    return this.expensesService.replaceInvoice(
      id,
      {
        fileName: stored.fileName,
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        size: stored.size,
      },
      req.user,
    );
  }

  // ADMIN / APPROVER / PROCESSOR — requesters cannot delete
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'APPROVER', 'PROCESSOR')
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.expensesService.delete(id, req.user);
  }
}
