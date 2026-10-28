import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { User, UserDocument } from '../../users/user.schema';
import { Expense, ExpenseDocument } from '../../expenses/expense.schema';
import { Project, ProjectDocument } from '../../projects/project.schema';
import { Category, CategoryDocument } from '../../categories/category.schema';
import { Country, CountryDocument } from '../../countries/country.schema';
import {
  Notification,
  NotificationDocument,
} from '../../notifications/notification.schema';
import { currentDemo } from './demo-scope';
import { DEMO_CONNECTION } from './store.constants';

/**
 * Picks live vs demo Mongoose models from AsyncLocalStorage (currentDemo()).
 * Schedulers / boot with no scope → live.
 */
@Injectable()
export class StoreModelsService {
  constructor(
    @InjectConnection() private readonly liveConnection: Connection,
    @InjectConnection(DEMO_CONNECTION) private readonly demoConnection: Connection,
    @InjectModel(User.name) private readonly liveUser: Model<UserDocument>,
    @InjectModel(User.name, DEMO_CONNECTION)
    private readonly demoUser: Model<UserDocument>,
    @InjectModel(Expense.name) private readonly liveExpense: Model<ExpenseDocument>,
    @InjectModel(Expense.name, DEMO_CONNECTION)
    private readonly demoExpense: Model<ExpenseDocument>,
    @InjectModel(Project.name) private readonly liveProject: Model<ProjectDocument>,
    @InjectModel(Project.name, DEMO_CONNECTION)
    private readonly demoProject: Model<ProjectDocument>,
    @InjectModel(Category.name)
    private readonly liveCategory: Model<CategoryDocument>,
    @InjectModel(Category.name, DEMO_CONNECTION)
    private readonly demoCategory: Model<CategoryDocument>,
    @InjectModel(Country.name) private readonly liveCountry: Model<CountryDocument>,
    @InjectModel(Country.name, DEMO_CONNECTION)
    private readonly demoCountry: Model<CountryDocument>,
    @InjectModel(Notification.name)
    private readonly liveNotification: Model<NotificationDocument>,
    @InjectModel(Notification.name, DEMO_CONNECTION)
    private readonly demoNotification: Model<NotificationDocument>,
  ) {}

  private get demo(): boolean {
    return currentDemo();
  }

  connection(): Connection {
    return this.demo ? this.demoConnection : this.liveConnection;
  }

  liveDbReady(): boolean {
    return this.liveConnection.readyState === 1;
  }

  demoDbReady(): boolean {
    return this.demoConnection.readyState === 1;
  }

  users(): Model<UserDocument> {
    return this.demo ? this.demoUser : this.liveUser;
  }

  expenses(): Model<ExpenseDocument> {
    return this.demo ? this.demoExpense : this.liveExpense;
  }

  projects(): Model<ProjectDocument> {
    return this.demo ? this.demoProject : this.liveProject;
  }

  categories(): Model<CategoryDocument> {
    return this.demo ? this.demoCategory : this.liveCategory;
  }

  countries(): Model<CountryDocument> {
    return this.demo ? this.demoCountry : this.liveCountry;
  }

  notifications(): Model<NotificationDocument> {
    return this.demo ? this.demoNotification : this.liveNotification;
  }
}
