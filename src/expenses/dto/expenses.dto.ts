import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExpenseDto {
  @ApiProperty({ example: 'Requester GAC' })
  requesterName: string;

  @ApiProperty({
    example: 'requester.gac@acefinance.com',
    description:
      'If this email belongs to a REQUESTER, they must be assigned to the project',
  })
  requesterEmail: string;

  @ApiProperty({
    type: Number,
    example: 1500,
    description: 'Amount in the country currency',
  })
  originalAmount: string | number;

  @ApiProperty({
    example: 'India',
    description: 'Active country name (GET /countries/active)',
  })
  country: string;

  @ApiProperty({
    example: 'Travel',
    description: 'Active category name (GET /categories/active)',
  })
  category: string;

  @ApiProperty({
    example: 'Google Art and culture (GAC)',
    description: 'Active project name (GET /projects/active)',
  })
  project: string;

  @ApiProperty({ example: 'Client visit travel' })
  description: string;

  @ApiProperty({ example: '2026-10-01' })
  date: string;

  @ApiProperty({ example: '2026-10-15' })
  dueDate: string;

  @ApiPropertyOptional({ example: 'INV-1001' })
  invoiceNumber?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  invoiceDate?: string;

  @ApiPropertyOptional({
    description:
      'Set to true when the user confirms a potential-duplicate warning (fuzzy triple). Hard duplicates (same file hash / invoice #) cannot be overridden — submit is auto-blocked and no expense is created.',
    example: false,
  })
  duplicateConfirmed?: boolean | string;

  @ApiPropertyOptional({
    description:
      'Unique client session token to prevent double-click submissions',
  })
  idempotencyKey?: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Invoice file (PDF / image)',
  })
  invoice: unknown;
}

export class UpdateExpenseDto {
  @ApiPropertyOptional({ example: 'Requester GAC' })
  requesterName?: string;

  @ApiPropertyOptional({ example: 'requester.gac@acefinance.com' })
  requesterEmail?: string;

  @ApiPropertyOptional({
    type: Number,
    example: 1600,
    description: 'Amount in the country currency (re-converted to USD)',
  })
  originalAmount?: string | number;

  @ApiPropertyOptional({
    example: 'India',
    description: 'Active country name (GET /countries/active)',
  })
  country?: string;

  @ApiPropertyOptional({
    example: 'Travel',
    description: 'Active category name (GET /categories/active)',
  })
  category?: string;

  @ApiPropertyOptional({
    example: 'Google Art and culture (GAC)',
    description: 'Active project name (GET /projects/active)',
  })
  project?: string;

  @ApiPropertyOptional({ example: 'Client visit travel (corrected)' })
  description?: string;

  @ApiPropertyOptional({ example: '2026-10-01' })
  date?: string;

  @ApiPropertyOptional({ example: '2026-10-15' })
  dueDate?: string;

  @ApiPropertyOptional({ example: 'INV-1001' })
  invoiceNumber?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  invoiceDate?: string;
}

export class ExpenseNotesDto {
  @ApiPropertyOptional({ example: 'Looks good' })
  notes?: string;
}

export class RequestChangesDto {
  @ApiPropertyOptional({ example: 'Please attach a clearer invoice' })
  notes?: string;

  @ApiPropertyOptional({
    enum: ['requester', 'approver'],
    default: 'requester',
  })
  target?: 'requester' | 'approver';
}

export class ProcessExpenseDto {
  @ApiPropertyOptional({ example: 'Paid via bank transfer' })
  notes?: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Payment receipt file',
  })
  receipt: unknown;
}

export class PartialPayDto {
  @ApiProperty({
    type: Number,
    example: 50,
    description: 'Amount paid now, in USD',
  })
  amount: string | number;

  @ApiPropertyOptional({ example: 'First instalment via bank transfer' })
  notes?: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Payment receipt file',
  })
  receipt: unknown;
}

export class ReplaceInvoiceDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'New invoice file',
  })
  invoice: unknown;
}
