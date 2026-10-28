import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ExpensesModule } from './expenses/expenses.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { ProjectsModule } from './projects/projects.module';
import { CountriesModule } from './countries/countries.module';
import { FxModule } from './fx/fx.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StoreModule } from './common/store/store.module';
import { DEMO_CONNECTION } from './common/store/store.constants';
import {
  assertDistinctLiveDemoUris,
  resolveDemoMongoUri,
  resolveLiveMongoUri,
} from './common/store/mongo-uri';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
    ]),
    ScheduleModule.forRoot(),
    // Live database (default connection)
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const live = resolveLiveMongoUri(
          configService.getOrThrow<string>('MONGODB_URI'),
        );
        const demo = resolveDemoMongoUri(
          live,
          configService.get<string>('MONGODB_URI_DEMO'),
        );
        assertDistinctLiveDemoUris(live, demo);
        return { uri: live };
      },
      inject: [ConfigService],
    }),
    // Demo database (separate DB on same cluster by default)
    MongooseModule.forRootAsync({
      connectionName: DEMO_CONNECTION,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const live = resolveLiveMongoUri(
          configService.getOrThrow<string>('MONGODB_URI'),
        );
        const demo = resolveDemoMongoUri(
          live,
          configService.get<string>('MONGODB_URI_DEMO'),
        );
        assertDistinctLiveDemoUris(live, demo);
        return { uri: demo };
      },
      inject: [ConfigService],
    }),
    StoreModule,
    ExpensesModule,
    UsersModule,
    AuthModule,
    CategoriesModule,
    ProjectsModule,
    CountriesModule,
    FxModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
