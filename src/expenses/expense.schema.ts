import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ExpenseDocument = Expense & Document;

@Schema({ _id: false })
export class HistoryLog {
  @Prop({ required: true })
  action: string;

  @Prop({ required: true })
  timestamp: string;

  @Prop({ required: true })
  user: string;

  @Prop()
  notes?: string;
}

const HistoryLogSchema = SchemaFactory.createForClass(HistoryLog);

@Schema({ collection: 'expenses' })
export class Expense {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  requesterName: string;

  @Prop({ required: true })
  requesterEmail: string;

  @Prop({ required: true })
  amount: number;

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
  category: string;

  @Prop({ required: true })
  project: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  date: string;

  @Prop({ required: true })
  dueDate: string;

  @Prop({ required: true, default: 'PENDING_APPROVER' })
  status: string;

  @Prop({ required: true })
  submittedAt: string;

  @Prop()
  approverNotes?: string;

  @Prop()
  processorNotes?: string;

  @Prop()
  approvedAt?: string;

  @Prop()
  processedAt?: string;

  @Prop({ type: [HistoryLogSchema], default: [] })
  history: HistoryLog[];
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);
