import { Controller, Get, Header } from '@nestjs/common';
import { AppService } from './app.service';
import { renderBrandPage } from './common/api-brand-page';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  getHome(): string {
    return this.appService.getWelcomePage();
  }

  /** Simple health check for uptime monitors (JSON). */
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'Aceolution Finance API',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Branded “service unavailable” preview page (HTML).
   * Real full outages (process not running) cannot be served by Nest — use a reverse proxy for that.
   */
  @Get('status/unavailable')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getUnavailablePreview(): string {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    return renderBrandPage({
      title: 'Service Unavailable',
      badge: '503 · Service Unavailable',
      badgeTone: 'error',
      heading: 'API temporarily <span class="accent">unavailable</span>',
      message:
        'This is the branded downtime page. If the API process is fully stopped, a reverse proxy (or the frontend) should show a similar screen.',
      detail: 'GET /status/unavailable',
      actions: [
        { label: 'API Home', href: '/', primary: true },
        { label: 'Open Frontend', href: `${frontendUrl}/` },
        { label: 'Health check', href: '/health' },
      ],
    });
  }
}
