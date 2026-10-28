import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { enterDemoScope } from './demo-scope';

/**
 * After JWT auth: route the request to live or demo Mongo/storage.
 * Token field `store: 'demo'` wins; else fall back to `isDemo`.
 */
@Injectable()
export class DemoScopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      user?: { store?: string; isDemo?: boolean };
    }>();
    const user = req?.user;
    const demo =
      user?.store === 'demo' ||
      (user?.store !== 'live' && Boolean(user?.isDemo));

    enterDemoScope(demo);
    return next.handle();
  }
}
