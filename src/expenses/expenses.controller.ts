import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  StreamableFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Readable } from 'stream';
import * as crypto from 'crypto';
import { ExpensesService } from './expenses.service';
import { attachmentMulterOptions } from './attachment-upload';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { ActingUser } from './expenses.service';
import { assertAttachmentMagic } from '../common/file-magic';
import {
  CreateExpenseDto,
  ExpenseNotesDto,
  PartialPayDto,
  ProcessExpenseDto,
  ReplaceInvoiceDto,
  RequestChangesDto,
  UpdateExpenseDto,
} from './dto/expenses.dto';
import { howWhy } from '../common/swagger/api-guide';
import { ApiSopResponses, ApiStandardErrors } from '../common/swagger/api-sop';
import {
  APPROVE_EXAMPLES,
  REJECT_EXAMPLES,
  REQUEST_CHANGES_EXAMPLES,
  UPDATE_EXPENSE_EXAMPLES,
} from '../common/swagger/common-examples';
import {
  EXPENSE_APPROVED,
  EXPENSE_CHANGES_REQUESTED,
  EXPENSE_PARTIALLY_PAID,
  EXPENSE_PENDING,
  EXPENSE_PROCESSED,
  EXPENSE_PROCESSOR_REJECTED,
  EXPENSE_REJECTED,
  STATS_DATA,
} from '../common/swagger/sop-data-samples';

const EXPENSE_NOT_FOUND = `Expense with ID ${EXPENSE_PENDING.id} not found`;

@ApiTags('Expenses')
@Controller('expenses')
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly storageService: StorageService,
  ) {}

  private actingUserFromReq(req: any): ActingUser {
    return {
      userId: req.user.userId,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      assignedProjects: Array.isArray(req.user.assignedProjects)
        ? req.user.assignedProjects
        : [],
    };
  }

  // Authenticated submit — multipart with required invoice file
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('invoice', attachmentMulterOptions('invoice')),
  )
  @ApiOperation({
    summary: 'Submit expense request (authenticated, multipart)',
    description: howWhy({
      why: 'Requester raises a new expense with its invoice.',
      how: 'Bearer JWT + `multipart/form-data` with file field `invoice` (PDF / JPG / PNG / WEBP / GIF, max 5 MB). Requester email/name are taken from the token (body email is ignored).',
      when: 'Dashboard → Submit expense.',
      extras:
        '**Required:** originalAmount, country, category, project, description, date, dueDate, invoice. **Optional:** invoiceNumber, invoiceDate, `duplicateConfirmed`.\n**Hard duplicate** (same file SHA-256 / invoice #): HTTP 400 — request is **not created**.\n**Potential duplicate**: 400 with `POTENTIAL_DUPLICATE:…` unless `duplicateConfirmed=true`.',
    }),
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateExpenseDto })
  @ApiSopResponses({
    successStatus: 201,
    successData: EXPENSE_PENDING,
    auth: true,
    badRequest: 'Invoice attachment is required.',
    forbidden:
      'You are not assigned to project "Google News Lab (GNL)". Contact an administrator.',
  })
  async create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Omit<CreateExpenseDto, 'invoice'>,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Invoice attachment is required.');
    }

    const actingUser = this.actingUserFromReq(req);
    assertAttachmentMagic(file.buffer, file.mimetype, 'invoice');

    const fileHash = crypto
      .createHash('sha256')
      .update(file.buffer)
      .digest('hex');

    const parsedDoc = await this.expensesService.parseInvoiceDocument(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // Pre-flight duplicate check: abort before uploading to blob storage if already submitted
    await this.expensesService.assertNotDuplicate({
      invoiceNumber: body.invoiceNumber?.trim() || undefined,
      extractedInvoiceNumber: parsedDoc.invoiceNumber,
      fileHash,
      project: body.project,
      originalAmount: Number(body.originalAmount),
      country: body.country,
      invoiceDate: body.invoiceDate || undefined,
    });

    const duplicateConfirmed = Boolean(
      body.duplicateConfirmed === 'true' || body.duplicateConfirmed === true,
    );

    if (!duplicateConfirmed) {
      const potential = await this.expensesService.checkPotentialDuplicate({
        project: body.project,
        category: body.category,
        originalAmount: Number(body.originalAmount),
        country: body.country,
        date: body.date,
      });
      if (potential.isPotentialDuplicate && potential.conflict) {
        throw new BadRequestException(
          `POTENTIAL_DUPLICATE: ${potential.conflict.reason} If this is a separate and distinct expense, please confirm the duplicate checkbox before submitting.`,
        );
      }
    }

    // ACL + catalogs + dates before any Azure write
    await this.expensesService.assertCanCreateExpense(
      {
        category: body.category,
        project: body.project,
        country: body.country,
        date: body.date,
        dueDate: body.dueDate,
        originalAmount: Number(body.originalAmount),
      },
      actingUser,
    );

    const expenseId = this.expensesService.generateExpenseId();
    const stored = await this.storageService.saveAttachment('invoices', file, {
      expenseId,
      kind: 'invoice',
    });

    try {
      return await this.expensesService.create(
        {
          requesterName: body.requesterName || actingUser.name,
          requesterEmail: actingUser.email,
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
          duplicateConfirmed,
          idempotencyKey: body.idempotencyKey,
        },
        {
          fileName: stored.fileName,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          size: stored.size,
          fileHash,
          extractedInvoiceNumber: parsedDoc.invoiceNumber,
          extractedInvoiceDate: parsedDoc.invoiceDate,
          extractedAmount: parsedDoc.amount,
          extractedCurrency: parsedDoc.currency,
          extractedVendor: parsedDoc.vendor,
          parseMethod: parsedDoc.parseMethod,
        },
        actingUser,
      );
    } catch (err) {
      // create() deletes the blob on Mongo save failure; this covers throws before save
      // (duplicate race, etc.). Safe to call again (deleteIfExists).
      await this.storageService.deleteAttachment('invoices', stored.fileName);
      throw err;
    }
  }

  @Post('parse-invoice')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file', attachmentMulterOptions('invoice')))
  @ApiOperation({
    summary: 'Parse invoice document via local OCR / PDF Parse (Zero AI)',
    description:
      'Extracts invoice number, date, amount, currency, and vendor directly from the uploaded PDF or image using local pdf-parse and Tesseract OCR. Requires Bearer JWT.',
  })
  @ApiConsumes('multipart/form-data')
  async parseInvoice(@UploadedFile() file: Express.Multer.File | undefined) {
    if (
      process.env.ENABLE_INVOICE_PARSE === 'false' ||
      process.env.ENABLE_INVOICE_PARSE === '0'
    ) {
      return {
        success: false,
        message: 'Invoice parsing is disabled in environment configuration.',
      };
    }
    if (!file) {
      throw new BadRequestException('File is required for parsing.');
    }
    assertAttachmentMagic(file.buffer, file.mimetype, 'invoice');
    const result = await this.expensesService.parseInvoiceDocument(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
    return {
      success: true,
      data: result,
    };
  }

  @Get('check-duplicate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Pre-flight check for duplicate and potential duplicate expenses',
    description: howWhy({
      why: 'Validate before upload / confirm UI — same rules as submit hard block + soft warning.',
      how: 'GET (Bearer) query: `invoiceNumber`, `fileHash`, `project`, `category`, `amount`, `currency`, `country`, `date`, `excludeExpenseId`.',
      when: 'Submit form live validation, or Postman before multipart submit.',
      extras:
        'Hard = same invoice file / number (blocked). Soft = fuzzy triple project+category+amount ±1 day (confirm to proceed). Rejected expenses are excluded.',
    }),
  })
  async checkDuplicate(
    @Query('invoiceNumber') invoiceNumber?: string,
    @Query('fileHash') fileHash?: string,
    @Query('project') project?: string,
    @Query('category') category?: string,
    @Query('amount') amount?: string,
    @Query('currency') currency?: string,
    @Query('country') country?: string,
    @Query('date') date?: string,
    @Query('excludeExpenseId') excludeExpenseId?: string,
  ) {
    return this.expensesService.preflightCheckDuplicate({
      invoiceNumber: invoiceNumber?.trim() || undefined,
      fileHash: fileHash?.trim() || undefined,
      project: project?.trim() || undefined,
      category: category?.trim() || undefined,
      amount:
        amount && !Number.isNaN(Number(amount)) ? Number(amount) : undefined,
      currency: currency?.trim() || undefined,
      country: country?.trim() || undefined,
      date: date?.trim() || undefined,
      excludeExpenseId: excludeExpenseId?.trim() || undefined,
    });
  }

  // Protected — role-aware list (Approvers only see assigned projects)
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List expenses (role-scoped)',
    description: howWhy({
      why: 'Dashboard table.',
      how: 'GET → newest first. APPROVER only sees assigned projects; other roles see all. Optional `?email=` filters by requester.',
    }),
  })
  @ApiQuery({
    name: 'email',
    required: false,
    description: 'Filter by requester email',
  })
  @ApiSopResponses({ successData: [EXPENSE_PENDING, EXPENSE_PROCESSED] })
  async findAll(@Request() req: any, @Query('email') email?: string) {
    const expenses = await this.expensesService.findAllForUser({
      userId: req.user.userId,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      assignedProjects: Array.isArray(req.user.assignedProjects)
        ? req.user.assignedProjects
        : [],
    });
    if (email) {
      return expenses.filter(
        (e) => e.requesterEmail.toLowerCase() === email.toLowerCase(),
      );
    }
    return expenses;
  }

  // Protected — dashboard stats (scoped like expense list for Approvers)
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Dashboard stats (role-scoped)',
    description: howWhy({
      why: 'Dashboard cards, category chart and recent activity.',
      how: 'GET → totals in USD, scoped exactly like GET /expenses.',
    }),
  })
  @ApiSopResponses({ successData: STATS_DATA })
  async getStats(@Request() req: any) {
    return this.expensesService.getStats({
      userId: req.user.userId,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      assignedProjects: Array.isArray(req.user.assignedProjects)
        ? req.user.assignedProjects
        : [],
    });
  }

  // Protected — logged-in user's own expenses only
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Signed-in user's own expenses",
    description: howWhy({
      why: 'Requester → "My requests".',
      how: 'GET → expenses where requesterEmail = your email.',
    }),
  })
  @ApiSopResponses({ successData: [EXPENSE_CHANGES_REQUESTED] })
  async findMine(@Request() req: any) {
    return this.expensesService.findMine(req.user.email);
  }

  // Protected — download / view invoice attachment
  @Get(':id/invoice')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'View / download invoice file',
    description: howWhy({
      why: 'Open the invoice from the request detail.',
      how: 'GET with Bearer → binary file (`Content-Disposition: inline`). In Swagger use "Download file".',
    }),
  })
  @ApiProduces('application/pdf', 'image/*')
  @ApiStandardErrors({ notFound: 'No invoice attached to this expense.' })
  async getInvoice(
    @Param('id') id: string,
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const invoice = await this.expensesService.getInvoiceFile(
      id,
      this.actingUserFromReq(req),
    );
    res.set({
      'Content-Type': invoice.mimeType,
      'Content-Disposition': `inline; filename="${invoice.originalName.replace(/"/g, '')}"`,
    });
    return new StreamableFile(Readable.from(invoice.buffer));
  }

  // Protected — download / view a payment receipt
  @Get(':id/payment-receipt/:fileName')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'View / download a payment receipt',
    description: howWhy({
      why: 'Open a processor receipt from the payment history.',
      how: 'GET with Bearer. `fileName` = `paymentReceipts[].fileName` from the expense. Caller must own the expense or be staff for that project.',
    }),
  })
  @ApiProduces('application/pdf', 'image/*')
  @ApiStandardErrors({ notFound: 'Payment receipt not found on this expense.' })
  async getPaymentReceipt(
    @Param('id') id: string,
    @Param('fileName') fileName: string,
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const receipt = await this.expensesService.getPaymentReceiptFile(
      id,
      fileName,
      this.actingUserFromReq(req),
    );
    res.set({
      'Content-Type': receipt.mimeType,
      'Content-Disposition': `inline; filename="${receipt.originalName.replace(/"/g, '')}"`,
    });
    return new StreamableFile(Readable.from(receipt.buffer));
  }

  // Authenticated detail only — no anonymous status enumeration
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get expense by ID (authorized viewers)',
    description: howWhy({
      why: 'Request detail for staff / owner.',
      how: 'Bearer required. Requester = own; Approver = assigned projects; Processor/Admin = all.',
    }),
  })
  @ApiSopResponses({
    successData: EXPENSE_APPROVED,
    notFound: EXPENSE_NOT_FOUND,
  })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.expensesService.findOneForViewer(
      id,
      this.actingUserFromReq(req),
    );
  }

  // APPROVER or ADMIN only
  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('APPROVER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Approve expense (APPROVER, ADMIN)',
    description: howWhy({
      why: 'Approver accepts the request → goes to processors.',
      how: 'PATCH `{ notes? }`. Status must be PENDING_APPROVER; approvers only for assigned projects.',
    }),
  })
  @ApiBody({ type: ExpenseNotesDto, examples: APPROVE_EXAMPLES })
  @ApiSopResponses({
    successData: EXPENSE_APPROVED,
    roles: ['APPROVER', 'ADMIN'],
    badRequest: 'Cannot approve expense. Current status is PROCESSED',
    notFound: EXPENSE_NOT_FOUND,
  })
  async approve(
    @Param('id') id: string,
    @Body('notes') notes: string,
    @Request() req: any,
  ) {
    return this.expensesService.approve(id, notes, req.user);
  }

  // APPROVER or ADMIN only
  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('APPROVER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reject expense (APPROVER, ADMIN)',
    description: howWhy({
      why: 'Approver declines the request (final).',
      how: 'PATCH `{ notes }` with the reason. Status must be PENDING_APPROVER.',
    }),
  })
  @ApiBody({ type: ExpenseNotesDto, examples: REJECT_EXAMPLES })
  @ApiSopResponses({
    successData: EXPENSE_REJECTED,
    roles: ['APPROVER', 'ADMIN'],
    badRequest: 'Cannot reject expense. Current status is APPROVED_APPROVER',
    notFound: EXPENSE_NOT_FOUND,
  })
  async reject(
    @Param('id') id: string,
    @Body('notes') notes: string,
    @Request() req: any,
  ) {
    return this.expensesService.reject(id, notes, req.user);
  }

  // APPROVER / PROCESSOR / ADMIN — return for changes (requester) or undo approval (approver)
  @Patch(':id/request-changes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('APPROVER', 'PROCESSOR', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send back for changes (APPROVER, PROCESSOR, ADMIN)',
    description: howWhy({
      why: 'Something needs fixing before it can move on.',
      how: 'PATCH `{ notes, target }`. `notes` is required.',
      extras:
        '- PENDING_APPROVER → approver sends to `requester` (→ CHANGES_REQUESTED)\n- APPROVED_APPROVER → processor sends to `requester` (→ CHANGES_REQUESTED) or `approver` (→ PENDING_APPROVER)',
    }),
  })
  @ApiBody({ type: RequestChangesDto, examples: REQUEST_CHANGES_EXAMPLES })
  @ApiSopResponses({
    successData: EXPENSE_CHANGES_REQUESTED,
    roles: ['APPROVER', 'PROCESSOR', 'ADMIN'],
    badRequest: 'Notes are required when requesting changes.',
    notFound: EXPENSE_NOT_FOUND,
  })
  async requestChanges(
    @Param('id') id: string,
    @Body() body: RequestChangesDto,
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
  @UseInterceptors(
    FileInterceptor('receipt', attachmentMulterOptions('receipt')),
  )
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Pay remaining amount — receipt required (PROCESSOR, ADMIN)',
    description: howWhy({
      why: 'Processor completes payment → PROCESSED.',
      how: '`multipart/form-data` with file `receipt` (+ `notes`). Pays whatever USD is still owed.',
      when: 'Status APPROVED_APPROVER or PARTIALLY_PAID.',
    }),
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: ProcessExpenseDto })
  @ApiSopResponses({
    successData: EXPENSE_PROCESSED,
    roles: ['PROCESSOR', 'ADMIN'],
    badRequest: 'Payment receipt attachment is required.',
    notFound: EXPENSE_NOT_FOUND,
  })
  async process(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Omit<ProcessExpenseDto, 'receipt'>,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Payment receipt attachment is required.');
    }
    assertAttachmentMagic(file.buffer, file.mimetype, 'receipt');
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
  @UseInterceptors(
    FileInterceptor('receipt', attachmentMulterOptions('receipt')),
  )
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Partial payout — receipt required (PROCESSOR, ADMIN)',
    description: howWhy({
      why: 'Pay part of the amount now (instalments).',
      how: '`multipart/form-data` with `amount` (USD, less than remaining) + file `receipt` (+ `notes`). Paying the full remainder marks it PROCESSED.',
      when: 'Status APPROVED_APPROVER or PARTIALLY_PAID.',
    }),
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: PartialPayDto })
  @ApiSopResponses({
    successData: EXPENSE_PARTIALLY_PAID,
    roles: ['PROCESSOR', 'ADMIN'],
    badRequest: 'Payment amount must be greater than $0.00',
    notFound: EXPENSE_NOT_FOUND,
  })
  async partialPay(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Omit<PartialPayDto, 'receipt'>,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Payment receipt attachment is required.');
    }
    assertAttachmentMagic(file.buffer, file.mimetype, 'receipt');
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
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reject at payment stage (PROCESSOR, ADMIN)',
    description: howWhy({
      why: 'Processor cannot pay an approved request (final).',
      how: 'PATCH `{ notes }` with the reason. Status must be APPROVED_APPROVER or PARTIALLY_PAID.',
    }),
  })
  @ApiBody({ type: ExpenseNotesDto, examples: REJECT_EXAMPLES })
  @ApiSopResponses({
    successData: EXPENSE_PROCESSOR_REJECTED,
    roles: ['PROCESSOR', 'ADMIN'],
    badRequest: 'Cannot reject expense. Current status is PROCESSED',
    notFound: EXPENSE_NOT_FOUND,
  })
  async processorReject(
    @Param('id') id: string,
    @Body('notes') notes: string,
    @Request() req: any,
  ) {
    return this.expensesService.processorReject(id, notes, req.user);
  }

  // REQUESTER (own pending / changes-requested) or ADMIN — JSON field update
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'REQUESTER')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Edit / resubmit expense (REQUESTER own, ADMIN)',
    description: howWhy({
      why: 'Requester fixes a request after "changes requested".',
      how: 'PUT any subset of the JSON fields → status goes back to PENDING_APPROVER. Changing amount / country re-converts to USD.',
      when: 'Only while status is CHANGES_REQUESTED (requester: own requests; admin: any).',
    }),
  })
  @ApiBody({ type: UpdateExpenseDto, examples: UPDATE_EXPENSE_EXAMPLES })
  @ApiSopResponses({
    successData: EXPENSE_PENDING,
    roles: ['ADMIN', 'REQUESTER'],
    badRequest:
      'You can only edit a request after staff has requested changes.',
    notFound: EXPENSE_NOT_FOUND,
  })
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
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
  @UseInterceptors(
    FileInterceptor('invoice', attachmentMulterOptions('invoice')),
  )
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Replace invoice file (REQUESTER own, ADMIN)',
    description: howWhy({
      why: 'Attach a corrected invoice while editing.',
      how: '`multipart/form-data` with file `invoice`. Status stays CHANGES_REQUESTED — then PUT /expenses/{id} to resubmit.',
      when: 'Only while status is CHANGES_REQUESTED (before resubmitting).',
    }),
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: ReplaceInvoiceDto })
  @ApiSopResponses({
    successData: EXPENSE_CHANGES_REQUESTED,
    roles: ['ADMIN', 'REQUESTER'],
    badRequest:
      'You can only edit a request after staff has requested changes.',
    notFound: EXPENSE_NOT_FOUND,
  })
  async replaceInvoice(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Invoice attachment is required.');
    }
    assertAttachmentMagic(file.buffer, file.mimetype, 'invoice');

    const actingUser = this.actingUserFromReq(req);
    // ACL before any Azure write
    await this.expensesService.assertCanReplaceInvoice(id, actingUser);

    const fileHash = crypto
      .createHash('sha256')
      .update(file.buffer)
      .digest('hex');

    // Pre-flight duplicate check: abort before uploading if file is already submitted elsewhere
    await this.expensesService.assertNotDuplicate({
      fileHash,
      excludeExpenseId: id,
    });

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
        fileHash,
      },
      actingUser,
    );
  }

  // ADMIN / APPROVER / PROCESSOR — requesters cannot delete
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'APPROVER', 'PROCESSOR')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete expense (ADMIN, APPROVER, PROCESSOR)',
    description: howWhy({
      why: 'Remove a duplicate / test request permanently (incl. invoice + receipts).',
      how: 'DELETE with the expense `id` (EXP-…). Empty 200 response.',
    }),
  })
  @ApiSopResponses({
    successData: '',
    successDescription: 'Deleted (empty body)',
    roles: ['ADMIN', 'APPROVER', 'PROCESSOR'],
    notFound: EXPENSE_NOT_FOUND,
  })
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.expensesService.delete(id, req.user);
  }
}
