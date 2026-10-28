import { Module } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { ExpensesScheduler } from './expenses.scheduler';
import { CategoriesModule } from '../categories/categories.module';
import { ProjectsModule } from '../projects/projects.module';
import { CountriesModule } from '../countries/countries.module';
import { FxModule } from '../fx/fx.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { InvoiceParseService } from './invoice-parse.service';

@Module({
  imports: [
    CategoriesModule,
    ProjectsModule,
    CountriesModule,
    FxModule,
    MailModule,
    UsersModule,
    StorageModule,
    NotificationsModule,
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService, ExpensesScheduler, InvoiceParseService],
  exports: [ExpensesService, InvoiceParseService],
})
export class ExpensesModule {}
