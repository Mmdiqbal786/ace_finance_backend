import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Query,
  Redirect,
  Req,
  Res,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Connection, ConnectionStates } from 'mongoose';
import { AppService } from './app.service';
import { renderUnavailablePage } from './common/api-brand-page';
import { wantsHtml } from './common/api-exception.filter';
import { howWhy } from './common/swagger/api-guide';
import { ApiSopResponses } from './common/swagger/api-sop';
import { getOpenApiDocument } from './common/swagger/openapi-store';
import { HEALTH_DATA } from './common/swagger/sop-data-samples';
import { DEMO_CONNECTION } from './common/store/store.constants';

function assertApiDocsEnabled() {
  const enabled =
    process.env.ENABLE_API_DOCS === 'true' ||
    process.env.NODE_ENV !== 'production';
  if (!enabled) {
    throw new NotFoundException('API docs are disabled on this environment.');
  }
}

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectConnection() private readonly connection: Connection,
    @InjectConnection(DEMO_CONNECTION) private readonly demoConnection: Connection,
  ) {}

  @Get()
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'text/html; charset=utf-8')
  getHome(): string {
    const docsEnabled =
      process.env.ENABLE_API_DOCS === 'true' ||
      process.env.NODE_ENV !== 'production';
    if (!docsEnabled) {
      return this.appService.getWelcomePage(null);
    }
    return this.appService.getWelcomePage(getOpenApiDocument());
  }

  @Get('api')
  @ApiExcludeEndpoint()
  @Redirect('/', 302)
  apiHome() {}

  @Get('docs')
  @ApiExcludeEndpoint()
  @Redirect('/api/docs', 302)
  docsShortcut() {}

  @Get('api/docs')
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  getSwaggerDocs(): string {
    assertApiDocsEnabled();
    return this.appService.getSwaggerPage();
  }

  @Get('api/openapi')
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'text/html; charset=utf-8')
  getOpenApiPage(@Req() req: Request): string {
    assertApiDocsEnabled();
    const proto = req.get('x-forwarded-proto')?.split(',')[0] ?? req.protocol;
    const baseUrl = `${proto}://${req.get('host') ?? 'localhost'}`;
    return this.appService.getOpenApiPage(getOpenApiDocument(), baseUrl);
  }

  /** JSON for monitors / scripts; browsers opening the URL get the designed status page. */
  @Get('health')
  @ApiOperation({
    summary: 'Health check',
    description: howWhy({
      why: 'Uptime monitors / Azure health probe.',
      how: 'GET (public) → `status: "ok"` while the API process is up. Opening it in a browser shows the designed status page; add `?format=json` to force JSON.',
    }),
  })
  @ApiSopResponses({ successData: HEALTH_DATA, auth: false })
  getHealth(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query('format') format?: string,
  ) {
    if (format !== 'json' && wantsHtml(req)) {
      return this.sendStatusPage(res, '/health');
    }
    const liveUp = this.connection.readyState === ConnectionStates.connected;
    const demoUp =
      this.demoConnection.readyState === ConnectionStates.connected;
    // Minimal public probe — no store topology / connection state details
    return {
      status: liveUp && demoUp ? 'ok' : 'degraded',
      service: 'Aceolution Finance API',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('status')
  @ApiExcludeEndpoint()
  getStatusPage(@Res({ passthrough: true }) res: Response) {
    return this.sendStatusPage(res, '/status');
  }

  private sendStatusPage(res: Response, refreshPath: string): string {
    const state = this.connection.readyState;
    const up = state === ConnectionStates.connected;
    res
      .status(up ? 200 : 503)
      .type('html')
      .setHeader('Cache-Control', 'no-store');
    return this.appService.getStatusPage(
      up,
      ConnectionStates[state] ?? 'unknown',
      refreshPath,
    );
  }

  /**
   * Branded “service unavailable” preview page (HTML).
   * Real full outages (process not running) cannot be served by Nest — use a reverse proxy for that.
   */
  @Get('status/unavailable')
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'text/html; charset=utf-8')
  getUnavailablePreview(): string {
    return renderUnavailablePage();
  }
}
