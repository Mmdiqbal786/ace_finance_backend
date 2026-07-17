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

  // Public — allow status tracking by email without login
  @Get()
  async findAll(@Query('email') email?: string) {
    const expenses = await this.expensesService.findAll();
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

  // APPROVER, PROCESSOR, ADMIN, or REQUESTER (own pending only)
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('APPROVER', 'PROCESSOR', 'ADMIN', 'REQUESTER')
  async update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.expensesService.update(id, body, req.user);
  }

  // ADMIN / APPROVER / PROCESSOR, or REQUESTER (own pending only)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'APPROVER', 'PROCESSOR', 'REQUESTER')
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.expensesService.delete(id, req.user);
  }
}
