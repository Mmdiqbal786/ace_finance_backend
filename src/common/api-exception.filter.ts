import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { renderNotFoundPage, renderServerErrorPage } from './api-brand-page';

function wantsHtml(req: Request): boolean {
  const accept = String(req.headers.accept || '');
  // API clients / fetch with JSON preference keep JSON responses
  if (accept.includes('application/json') && !accept.includes('text/html')) {
    return false;
  }
  if (req.headers['sec-fetch-dest'] === 'document') return true;
  return accept.includes('text/html');
}

function exceptionMessage(exception: unknown): string {
  if (exception instanceof HttpException) {
    const body = exception.getResponse();
    if (typeof body === 'string') return body;
    if (body && typeof body === 'object' && 'message' in body) {
      const msg = (body as { message?: string | string[] }).message;
      if (Array.isArray(msg)) return msg.join(' ');
      if (typeof msg === 'string') return msg;
    }
    return exception.message;
  }
  if (exception instanceof Error) return exception.message;
  return 'Internal server error';
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exceptionMessage(exception);

    if (!(exception instanceof HttpException) || status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} → ${status}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    if (!wantsHtml(req)) {
      const body =
        exception instanceof HttpException && typeof exception.getResponse() === 'object'
          ? exception.getResponse()
          : {
              statusCode: status,
              message,
              error: HttpStatus[status] || 'Error',
            };
      res.status(status).json(body);
      return;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    if (status === HttpStatus.NOT_FOUND) {
      res.status(status).send(renderNotFoundPage(req.originalUrl || req.url || '/'));
      return;
    }

    res.status(status).send(renderServerErrorPage(status, message));
  }
}
