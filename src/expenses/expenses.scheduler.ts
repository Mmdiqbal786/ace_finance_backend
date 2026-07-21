import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExpensesService } from './expenses.service';

@Injectable()
export class ExpensesScheduler {
  private readonly logger = new Logger(ExpensesScheduler.name);

  constructor(private readonly expensesService: ExpensesService) {}

  /** Runs every day at 8:00 AM server time. */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleDueSoonReminders() {
    this.logger.log('Running daily due-soon reminder jobs...');
    for (const daysLeft of [3, 1] as const) {
      try {
        const approver =
          await this.expensesService.sendApproverDueSoonReminders(daysLeft);
        this.logger.log(
          `Approver ${daysLeft}-day reminder: checked=${approver.checked} reminded=${approver.reminded}`,
        );
      } catch (err: any) {
        this.logger.error(
          `Approver ${daysLeft}-day reminder job failed: ${err?.message || err}`,
        );
      }

      try {
        const processor =
          await this.expensesService.sendProcessorDueSoonReminders(daysLeft);
        this.logger.log(
          `Processor ${daysLeft}-day reminder: checked=${processor.checked} reminded=${processor.reminded}`,
        );
      } catch (err: any) {
        this.logger.error(
          `Processor ${daysLeft}-day reminder job failed: ${err?.message || err}`,
        );
      }
    }
  }
}
