import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ example: 'Requester GAC' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  requesterName?: string;

  @ApiProperty({
    example: 'requester.gac@acefinance.com',
    description:
      'Ignored for ownership — JWT email is bound. Kept for Swagger/examples only.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(320)
  requesterEmail?: string;

  @ApiProperty({
    type: Number,
    example: 1500,
    description: 'Amount in the country currency',
  })
  @IsNotEmpty()
  originalAmount: string | number;

  @ApiProperty({
    example: 'India',
    description: 'Active country name (GET /countries/active)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  country: string;

  @ApiProperty({
    example: 'Travel',
    description: 'Active category name (GET /categories/active)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  category: string;

  @ApiProperty({
    example: 'Google Art and culture (GAC)',
    description: 'Active project name (GET /projects/active)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  project: string;

  @ApiProperty({ example: 'Client visit travel' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(4000)
  description: string;

  @ApiProperty({ example: '2026-10-01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  date: string;

  @ApiProperty({ example: '2026-10-15' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  dueDate: string;

  @ApiPropertyOptional({ example: 'INV-1001' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  invoiceNumber?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  invoiceDate?: string;

  @ApiPropertyOptional({
    description:
      'Set to true when the user confirms a potential-duplicate warning (fuzzy triple). Hard duplicates (same file hash / invoice #) cannot be overridden — submit is auto-blocked and no expense is created.',
    example: false,
  })
  @IsOptional()
  duplicateConfirmed?: boolean | string;

  @ApiPropertyOptional({
    description:
      'Unique client session token to prevent double-click submissions',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Invoice file (PDF / image)',
  })
  @IsOptional()
  invoice?: unknown;
}

export class UpdateExpenseDto {
  @ApiPropertyOptional({ example: 'Requester GAC' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  requesterName?: string;

  @ApiPropertyOptional({ example: 'requester.gac@acefinance.com' })
  @IsOptional()
  @IsString()
  @MaxLength(320)
  requesterEmail?: string;

  @ApiPropertyOptional({ type: Number, example: 1500 })
  @IsOptional()
  originalAmount?: string | number;

  @ApiPropertyOptional({ example: 'India' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string;

  @ApiPropertyOptional({ example: 'Travel' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @ApiPropertyOptional({ example: 'Google Art and culture (GAC)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  project?: string;

  @ApiPropertyOptional({ example: 'Client visit travel' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  date?: string;

  @ApiPropertyOptional({ example: '2026-10-15' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  dueDate?: string;

  @ApiPropertyOptional({ example: 'INV-1001' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  invoiceNumber?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  invoiceDate?: string;
}

export class ExpenseNotesDto {
  @ApiPropertyOptional({ example: 'Looks good' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class ProcessExpenseDto {
  @ApiPropertyOptional({ example: 'Paid via wire' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Payment receipt file',
  })
  @IsOptional()
  receipt?: unknown;
}

export class PartialPayDto {
  @ApiProperty({ example: 100, description: 'USD amount to pay now' })
  @IsNotEmpty()
  amount: string | number;

  @ApiPropertyOptional({ example: 'First instalment' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Payment receipt file',
  })
  @IsOptional()
  receipt?: unknown;
}

export class ReplaceInvoiceDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Replacement invoice file',
  })
  @IsOptional()
  invoice?: unknown;
}

export class RequestChangesDto {
  @ApiPropertyOptional({ example: 'Please attach a clearer invoice' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @ApiPropertyOptional({
    enum: ['requester', 'approver'],
    default: 'requester',
  })
  @IsOptional()
  @IsString()
  target?: 'requester' | 'approver';
}
