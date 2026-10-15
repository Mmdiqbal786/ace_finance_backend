import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ExpenseDocument = Expense & Document;

@Schema({ _id: false })
export class HistoryLog {
  @Prop({ required: true })
  action!: string;

  @Prop({ required: true })
  timestamp!: string;

  @Prop({ required: true })
  user!: string;

  @Prop()
  notes?: string;

  /** USD paid in this step (partial or final payout) */
  @Prop()
  paymentAmount?: number;

  /** Cumulative USD paid after this step */
  @Prop()
  totalPaid?: number;

  /** USD still owed after this step */
  @Prop()
  remaining?: number;
}

const HistoryLogSchema = SchemaFactory.createForClass(HistoryLog);

@Schema({ _id: false })
export class PaymentReceipt {
  @Prop({ required: true })
  fileName!: string;

  @Prop({ required: true })
  originalName!: string;

  @Prop()
  mimeType?: string;

  @Prop()
  size?: number;

  @Prop({ required: true })
  uploadedAt!: string;

  @Prop()
  uploadedBy?: string;

  @Prop()
  paymentAmount?: number;
}

const PaymentReceiptSchema = SchemaFactory.createForClass(PaymentReceipt);

@Schema({ collection: 'expenses' })
export class Expense {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true })
  requesterName!: string;

  @Prop({ required: true })
  requesterEmail!: string;

  @Prop({ required: true })
  amount!: number;

  /** Cumulative USD amount paid so far (partial payouts) */
  @Prop({ default: 0 })
  paidAmount?: number;

  /** Amount entered in the country's currency */
  @Prop()
  originalAmount?: number;

  @Prop()
  country?: string;

  /** ISO currency code from the selected country, e.g. INR */
  @Prop()
  currency?: string;

  /** 1 unit of local currency = exchangeRate USD (at submission) */
  @Prop()
  exchangeRate?: number;

  @Prop()
  exchangeRateDate?: string;

  @Prop({ required: true })
  category!: string;

  @Prop({ required: true })
  project!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true })
  date!: string;

  @Prop({ required: true })
  dueDate!: string;

  @Prop({ trim: true, maxlength: 100 })
  invoiceNumber?: string;

  @Prop()
  invoiceDate?: string;

  @Prop({ required: true, default: 'PENDING_APPROVER' })
  status!: string;

  @Prop({ required: true })
  submittedAt!: string;

  @Prop()
  approverNotes?: string;

  @Prop()
  processorNotes?: string;

  /** Latest staff instruction when changes were requested (shown in tracker/report). */
  @Prop()
  changeRequestNotes?: string;

  @Prop()
  changeRequestedAt?: string;

  @Prop()
  changeRequestedBy?: string;

  @Prop()
  approvedAt?: string;

  @Prop()
  processedAt?: string;

  /** Set when the 1-day-left approver reminder email was sent (YYYY-MM-DD of due date). */
  @Prop()
  approverDueSoonReminderSentOn?: string;

  /** Set when the 3-day-left approver reminder email was sent. */
  @Prop()
  approverThreeDayReminderSentOn?: string;

  /** Set when the 1-day-left processor reminder email was sent (YYYY-MM-DD of due date). */
  @Prop()
  processorDueSoonReminderSentOn?: string;

  /** Set when the 3-day-left processor reminder email was sent. */
  @Prop()
  processorThreeDayReminderSentOn?: string;

  /** Stored filename under uploads/invoices/ */
  @Prop()
  invoiceFileName?: string;

  @Prop()
  invoiceOriginalName?: string;

  @Prop()
  invoiceMimeType?: string;

  @Prop()
  invoiceSize?: number;

  /** SHA-256 fingerprint of the uploaded invoice file to detect exact duplicate documents */
  @Prop({ index: true })
  invoiceFileHash?: string;

  /** Normalized alphanumeric representation of invoiceNumber for duplicate checking */
  @Prop({ index: true, trim: true })
  invoiceNumberNormalized?: string;

  /** Payment receipts attached by processor (full or partial payouts) */
  @Prop({ type: [PaymentReceiptSchema], default: [] })
  paymentReceipts?: PaymentReceipt[];

  /** Flagged when amount, category, date, and project closely match an existing expense */
  @Prop({ default: false, index: true })
  isPotentialDuplicate?: boolean;

  /** Explanatory note detailing the potential duplicate match for approvers and processors */
  @Prop()
  duplicateWarningReason?: string;

  /** Whether the submitter confirmed that this is a separate, distinct expense */
  @Prop({ default: false })
  duplicateConfirmedByRequester?: boolean;

  /** Submission token to prevent rapid double-click duplicate creation */
  @Prop({ index: true })
  idempotencyKey?: string;

  /** Document parsed values via local non-AI OCR / PDF-parse */
  @Prop({ index: true, trim: true })
  extractedInvoiceNumber?: string;

  @Prop()
  extractedInvoiceDate?: string;

  @Prop()
  extractedAmount?: number;

  @Prop()
  extractedCurrency?: string;

  @Prop()
  extractedVendor?: string;

  @Prop()
  parseMethod?: string;

  @Prop({ type: [HistoryLogSchema], default: [] })
  history!: HistoryLog[];
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);

ExpenseSchema.index({ invoiceNumberNormalized: 1, project: 1 });
ExpenseSchema.index({ invoiceFileHash: 1 });
ExpenseSchema.index({ extractedInvoiceNumber: 1, project: 1 });

const IGNORED_INVOICE_NUMBERS = new Set([
  'na',
  'none',
  'nil',
  'null',
  '0',
  'notapplicable',
  'notavailable',
  'pending',
]);

/**
 * Normalizes an invoice number for duplicate checking (strips symbols/spaces, lowercases).
 * Returns undefined if input is missing, too short (< 2 chars), or a generic placeholder (e.g. "N/A", "None").
 */
export function normalizeInvoiceNumber(val?: string): string | undefined {
  if (!val) return undefined;
  const cleaned = val.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (cleaned.length < 2 || IGNORED_INVOICE_NUMBERS.has(cleaned)) {
    return undefined;
  }
  return cleaned;
}

export function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
