import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { ExpensesScheduler } from './expenses.scheduler';
import { Expense, ExpenseSchema } from './expense.schema';
import { CategoriesModule } from '../categories/categories.module';
import { ProjectsModule } from '../projects/projects.module';
import { CountriesModule } from '../countries/countries.module';
import { FxModule } from '../fx/fx.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Expense.name, schema: ExpenseSchema }]),
    CategoriesModule,
    ProjectsModule,
    CountriesModule,
    FxModule,
    MailModule,
    UsersModule,
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService, ExpensesScheduler],
  exports: [ExpensesService],
})
export class ExpensesModule {}
