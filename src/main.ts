import * as dns from 'dns';
// Use Google DNS servers so MongoDB Atlas SRV & hostname resolution works
// even when the local DNS server doesn't support SRV records
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Ace Finance API listening on port ${port}`);
}
bootstrap();
