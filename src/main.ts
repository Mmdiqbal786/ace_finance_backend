import * as dns from 'dns';
// Prefer IPv4 — Render free tier often cannot reach outbound IPv6 (e.g. Gmail SMTP ENETUNREACH)
dns.setDefaultResultOrder('ipv4first');
// Use public DNS so MongoDB Atlas SRV & hostname resolution works
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalFilters(new ApiExceptionFilter());
  // Serve logo/assets only — do not treat "/" as a missing index.html (that caused 404)
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    index: false,
    fallthrough: true,
  });
  app.enableCors();
  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Aceolution Finance API listening on port ${port}`);
}
bootstrap();
