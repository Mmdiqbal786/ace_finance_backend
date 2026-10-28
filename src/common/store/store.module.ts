import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../users/user.schema';
import { Expense, ExpenseSchema } from '../../expenses/expense.schema';
import { Project, ProjectSchema } from '../../projects/project.schema';
import { Category, CategorySchema } from '../../categories/category.schema';
import { Country, CountrySchema } from '../../countries/country.schema';
import {
  Notification,
  NotificationSchema,
} from '../../notifications/notification.schema';
import { DEMO_CONNECTION } from './store.constants';
import { StoreModelsService } from './store-models.service';
import { DemoScopeInterceptor } from './demo-scope.interceptor';

const FEATURES = [
  { name: User.name, schema: UserSchema },
  { name: Expense.name, schema: ExpenseSchema },
  { name: Project.name, schema: ProjectSchema },
  { name: Category.name, schema: CategorySchema },
  { name: Country.name, schema: CountrySchema },
  { name: Notification.name, schema: NotificationSchema },
];

@Global()
@Module({
  imports: [
    MongooseModule.forFeature(FEATURES),
    MongooseModule.forFeature(FEATURES, DEMO_CONNECTION),
  ],
  providers: [
    StoreModelsService,
    { provide: APP_INTERCEPTOR, useClass: DemoScopeInterceptor },
  ],
  exports: [StoreModelsService, MongooseModule],
})
export class StoreModule {}
