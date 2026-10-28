import * as dns from 'dns';
// Prefer IPv4 — some hosts cannot reach outbound IPv6 (e.g. Gmail SMTP ENETUNREACH)
dns.setDefaultResultOrder('ipv4first');
// Use public DNS so MongoDB Atlas SRV & hostname resolution works
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { getAbsoluteFSPath } from 'swagger-ui-dist';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import {
  API_GUIDE_MARKDOWN,
  SWAGGER_TAG_DESCRIPTIONS,
} from './common/swagger/api-guide';
import { setOpenApiDocument } from './common/swagger/openapi-store';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalFilters(new ApiExceptionFilter());
  // Serve logo/assets only — do not treat "/" as a missing index.html (that caused 404)
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    index: false,
    fallthrough: true,
  });
  // Swagger UI bundle/css for the branded /api/docs page (served locally, no CDN)
  app.useStaticAssets(getAbsoluteFSPath(), {
    prefix: '/api/docs/assets',
    index: false,
  });
  const frontendOrigin = (
    process.env.FRONTEND_URL || 'http://localhost:3000'
  )
    .trim()
    .replace(/\/$/, '');
  const extraOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const corsOrigins = Array.from(
    new Set([
      frontendOrigin,
      ...extraOrigins,
      // Localhost only outside production (or when FRONTEND_URL is already local)
      ...(process.env.NODE_ENV !== 'production' ||
      frontendOrigin.startsWith('http://localhost')
        ? ['http://localhost:3000']
        : []),
    ]),
  );
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Demo-Access-Code',
      'X-Seed-Secret',
    ],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Aceolution Finance API')
    .setDescription(
      [
        API_GUIDE_MARKDOWN,
        '',
        '---',
        '',
        '### Where to find params in Swagger',
        '| Section | What it shows |',
        '|---------|---------------|',
        '| **Parameters** | Path + query only (`id`, `fileName`, `limit`, `currency`, …) |',
        '| **Request body** | JSON / multipart fields + **Examples** dropdown with filled values |',
        '| **Schema** | Each body field — `*` = required |',
        '| **Responses** | Success example + 400 / 401 / 403 / 404 error bodies |',
        '',
        'If Parameters says "No parameters", that is normal for POST create — open **Request body**.',
        '',
        '### Auth',
        '1. `POST /auth/login` (pick an account from the **Examples** dropdown) → copy `access_token`',
        '2. **Authorize** → paste the token → every lock-icon endpoint now works',
        '',
        'Postman: `postman/Aceolution-Finance.postman_collection.json` (same endpoints, token saved automatically).',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Authentication', SWAGGER_TAG_DESCRIPTIONS.Authentication)
    .addTag('Expenses', SWAGGER_TAG_DESCRIPTIONS.Expenses)
    .addTag('Users', SWAGGER_TAG_DESCRIPTIONS.Users)
    .addTag('Projects', SWAGGER_TAG_DESCRIPTIONS.Projects)
    .addTag('Categories', SWAGGER_TAG_DESCRIPTIONS.Categories)
    .addTag('Countries', SWAGGER_TAG_DESCRIPTIONS.Countries)
    .addTag('Notifications', SWAGGER_TAG_DESCRIPTIONS.Notifications)
    .addTag('FX', SWAGGER_TAG_DESCRIPTIONS.FX)
    .addTag('Health', SWAGGER_TAG_DESCRIPTIONS.Health)
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  setOpenApiDocument(document);
  // Docs enabled locally by default; production requires ENABLE_API_DOCS=true
  const docsEnabled =
    process.env.ENABLE_API_DOCS === 'true' ||
    process.env.NODE_ENV !== 'production';
  if (docsEnabled) {
    // JSON only at /api/docs-json — the branded UI page is AppController GET /api/docs
    SwaggerModule.setup('api/docs', app, document, {
      ui: false,
      raw: ['json'],
    });
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Aceolution Finance API listening on port ${port}`);
  if (docsEnabled) {
    console.log(`Swagger docs at http://localhost:${port}/api/docs`);
  } else {
    console.log('API docs disabled (set ENABLE_API_DOCS=true to enable)');
  }
}
void bootstrap();
