import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

/** Error body produced by ApiExceptionFilter for JSON clients (Nest default shape). */
export function errorBody(statusCode: number, message: string) {
  const error: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
  };
  return { statusCode, message, error: error[statusCode] ?? 'Error' };
}

export const ERR_401 = errorBody(401, 'Unauthorized');
export const err403 = (roles: string[]) =>
  errorBody(403, `Access denied. Required role: ${roles.join(' or ')}`);

/**
 * SOP: standard error Responses.
 * - `auth` (default true): 401 missing/invalid Bearer token; a string documents a custom 401 message
 * - `roles`: 403 role not allowed (pass the role list for the description)
 * - `forbidden`: 403 with a custom business-rule message (e.g. project not assigned)
 * - `badRequest`: 400 with a realistic message
 * - `notFound`: 404 with a realistic message
 * - `conflict`: 409 duplicate name / email
 */
export function ApiStandardErrors(opts: {
  auth?: boolean | string;
  roles?: string[];
  forbidden?: string;
  badRequest?: string | false;
  notFound?: string;
  conflict?: string;
}) {
  const decorators: MethodDecorator[] = [];

  if (opts.badRequest) {
    decorators.push(
      ApiBadRequestResponse({
        description: 'Bad request / business rule failed',
        schema: { example: errorBody(400, opts.badRequest) },
      }),
    );
  }
  if (typeof opts.auth === 'string') {
    decorators.push(
      ApiUnauthorizedResponse({
        description: opts.auth,
        schema: { example: errorBody(401, opts.auth) },
      }),
    );
  } else if (opts.auth !== false) {
    decorators.push(
      ApiUnauthorizedResponse({
        description: 'Missing or invalid Bearer token',
        schema: { example: ERR_401 },
      }),
    );
  }
  if (opts.forbidden) {
    decorators.push(
      ApiForbiddenResponse({
        description: opts.forbidden,
        schema: { example: errorBody(403, opts.forbidden) },
      }),
    );
  } else if (opts.roles?.length) {
    decorators.push(
      ApiForbiddenResponse({
        description: `Signed in but role is not one of: ${opts.roles.join(', ')}`,
        schema: { example: err403(opts.roles) },
      }),
    );
  }
  if (opts.notFound) {
    decorators.push(
      ApiNotFoundResponse({
        description: opts.notFound,
        schema: { example: errorBody(404, opts.notFound) },
      }),
    );
  }
  if (opts.conflict) {
    decorators.push(
      ApiConflictResponse({
        description: opts.conflict,
        schema: { example: errorBody(409, opts.conflict) },
      }),
    );
  }

  return applyDecorators(...decorators);
}

/**
 * Full SOP stack: success example (returned as-is, no envelope) + standard errors.
 * POST routes respond 201 in Nest unless overridden; everything else 200.
 */
export function ApiSopResponses(opts: {
  successData: unknown;
  successStatus?: 200 | 201;
  successDescription?: string;
  auth?: boolean | string;
  roles?: string[];
  forbidden?: string;
  badRequest?: string | false;
  notFound?: string;
  conflict?: string;
}) {
  const description = opts.successDescription ?? 'Success';
  const success =
    opts.successStatus === 201
      ? ApiCreatedResponse({
          description,
          schema: { example: opts.successData },
        })
      : ApiOkResponse({ description, schema: { example: opts.successData } });

  return applyDecorators(
    success,
    ApiStandardErrors({
      auth: opts.auth,
      roles: opts.roles,
      forbidden: opts.forbidden,
      badRequest: opts.badRequest,
      notFound: opts.notFound,
      conflict: opts.conflict,
    }),
  );
}
