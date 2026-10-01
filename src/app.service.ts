import { Injectable } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { renderStatusPage, type StatusCheck } from './common/api-brand-page';
import {
  ICONS,
  brandHead,
  brandMark,
  escapeHtml,
  frontendUrl,
} from './common/brand/brand-theme';
import { listOpenApiOperations } from './common/swagger/openapi-store';

const API_LINKS = [
  {
    href: '/api/docs',
    title: 'Swagger UI',
    description: 'Try every expense API in the browser.',
  },
  {
    href: '/api/openapi',
    title: 'OpenAPI spec',
    description: 'Designed list of every API route + JSON download.',
  },
  {
    href: '/health',
    title: 'Health page',
    description: 'Designed status page: API, database, uptime.',
  },
  {
    href: '/health?format=json',
    title: 'Health JSON',
    description: 'Monitor endpoint. No auth.',
  },
];

const COMMON_ROUTES = [
  ['POST', '/auth/login'],
  ['GET', '/users/me'],
  ['POST', '/expenses'],
  ['GET', '/expenses'],
  ['GET', '/expenses/mine'],
  ['PATCH', '/expenses/{id}/approve'],
  ['PATCH', '/expenses/{id}/process'],
  ['GET', '/fx/convert'],
];

const OPENAPI_SUMMARY =
  'Expense approval backend: requesters submit expenses with invoices, approvers approve / reject / request changes, processors pay (full or partial), admins manage users and catalogs.';

const HOME_CSS = `
  .home-head { margin-top: 20px; }
  .link-grid { margin-top: 32px; display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .link-card { display: block; text-decoration: none; transition: border-color 0.15s ease, transform 0.15s ease; }
  .link-card:hover { border-color: var(--af-accent); transform: translateY(-1px); }
  .link-card strong { display: block; font-weight: 600; color: var(--af-navy); }
  .link-card p { margin: 4px 0 0; font-size: 14px; color: #5b7a90; }
  .link-card small { display: block; margin-top: 12px; font-size: 12px; color: var(--af-navy-mid); word-break: break-all; }
  .routes-card { margin-top: 32px; }
  .route-list { list-style: none; margin: 16px 0 0; padding: 0; display: grid; gap: 8px; }
  .route-list li {
    display: flex; align-items: center; gap: 12px; border-radius: 10px;
    background: var(--af-sky); padding: 8px 12px;
  }
  .route-list .path { font: 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--af-navy); word-break: break-all; }
  .route-list .summary { margin-left: auto; font-size: 12px; color: #5b7a90; text-align: right; }
  .pill {
    display: inline-flex; align-items: center; gap: 8px; margin-top: 12px; padding: 4px 10px; border-radius: 999px;
    background: rgba(52, 211, 153, 0.15); color: #065f46; font-size: 12px; font-weight: 600;
  }
  .pill i { width: 8px; height: 8px; border-radius: 50%; background: #059669; }
  .home-actions { margin-top: 24px; }
  .tag-section { margin-top: 24px; }
  .tag-section .lead { margin-top: 6px; font-size: 13px; }
  .json-card { margin-top: 32px; }
  .json-card .row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; }
  .json-card pre {
    margin: 16px 0 0; max-height: 420px; overflow: auto; border-radius: 10px;
    background: var(--af-navy-deep); color: #e4f3fb; padding: 16px;
    font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  @media (max-width: 640px) {
    .link-grid { grid-template-columns: 1fr; }
    .route-list li { flex-wrap: wrap; }
    .route-list .summary { margin-left: 0; text-align: left; width: 100%; }
  }
`;

const SWAGGER_CSS = `
  .shell { padding-top: 28px; }
  .docs-nav { display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0 8px; }
  .docs-card { margin-top: 8px; padding: 0; overflow: hidden; }
  .swagger-ui { font-family: Inter, ui-sans-serif, system-ui, sans-serif !important; color: var(--af-text); }
  .swagger-ui .topbar, .swagger-ui .info hgroup.main, .swagger-ui section.models { display: none !important; }
  .swagger-ui .information-container.wrapper { padding: 20px 16px 4px !important; }
  .swagger-ui .info { margin: 0 !important; }
  .swagger-ui .info .renderedMarkdown h1, .swagger-ui .info .renderedMarkdown h2, .swagger-ui .info .renderedMarkdown h3 {
    color: var(--af-navy) !important; font-family: inherit !important; letter-spacing: -0.02em;
  }
  .swagger-ui .info .renderedMarkdown h1 { font-size: 20px !important; font-weight: 800 !important; margin: 0 0 8px !important; }
  .swagger-ui .info .renderedMarkdown h2 { font-size: 15px !important; font-weight: 700 !important; margin: 22px 0 8px !important; }
  .swagger-ui .info .renderedMarkdown h3 { font-size: 14px !important; font-weight: 700 !important; margin: 18px 0 6px !important; }
  .swagger-ui .info .renderedMarkdown p, .swagger-ui .info .renderedMarkdown li,
  .swagger-ui .info .renderedMarkdown td, .swagger-ui .info .renderedMarkdown th { color: var(--af-muted) !important; font-size: 13px !important; }
  .swagger-ui .info .renderedMarkdown th { color: var(--af-navy) !important; font-weight: 600 !important; }
  .swagger-ui .info .renderedMarkdown table { border-collapse: collapse; }
  .swagger-ui .info .renderedMarkdown td, .swagger-ui .info .renderedMarkdown th { border-bottom: 1px solid var(--af-sky); padding: 6px 12px 6px 0; }
  .swagger-ui .info .renderedMarkdown code { color: var(--af-navy-mid) !important; background: var(--af-sky) !important; border-radius: 6px; padding: 1px 6px; }
  .swagger-ui .info .renderedMarkdown pre { background: var(--af-navy-deep) !important; border-radius: 10px; padding: 14px 16px !important; }
  .swagger-ui .info .renderedMarkdown pre code { background: transparent !important; color: #e4f3fb !important; padding: 0; }
  .swagger-ui .info .renderedMarkdown hr { border: 0; border-top: 1px solid var(--af-sky); margin: 20px 0; }
  .swagger-ui .scheme-container { background: transparent !important; box-shadow: none !important; padding: 16px 16px 0 !important; margin: 0 !important; }
  .swagger-ui .wrapper { padding: 0 16px 8px !important; max-width: none !important; }
  .swagger-ui .filter-container { margin: 0 0 14px !important; }
  .swagger-ui .filter-container .operation-filter-input {
    border: 1.5px solid #cbd5e1 !important; background: #f8fafc !important; color: var(--af-text) !important;
    min-height: 40px; padding: 0 12px !important; border-radius: 10px !important;
  }
  .swagger-ui .filter-container .operation-filter-input:focus { border-color: var(--af-accent) !important; box-shadow: 0 0 0 3px rgba(78, 182, 232, 0.18) !important; }
  .swagger-ui .opblock-tag-section { margin: 0 0 14px !important; }
  .swagger-ui .opblock-tag {
    border: 0 !important; border-radius: 12px !important; background: #fff !important;
    padding: 12px 14px !important; margin: 0 0 8px !important; box-shadow: 0 2px 12px rgba(27, 74, 115, 0.06);
    font-size: 18px !important;
  }
  .swagger-ui .opblock-tag small { font-size: 13px !important; }
  .swagger-ui .opblock-tag:hover { background: #f7fbfd !important; }
  .swagger-ui .opblock-tag small, .swagger-ui .opblock-tag small p { color: #5b7a90 !important; }
  .swagger-ui .opblock-tag a span, .swagger-ui .opblock-tag span { color: var(--af-navy) !important; font-weight: 700 !important; }
  .swagger-ui .opblock { border: 0 !important; border-radius: 10px !important; box-shadow: none !important; margin: 0 0 8px !important; }
  .swagger-ui .opblock .opblock-summary { border: 0 !important; padding: 8px 10px !important; }
  .swagger-ui .opblock .opblock-summary-method {
    min-width: 68px !important; height: 28px !important; line-height: 28px !important; padding: 0 !important;
    border-radius: 8px !important; font-size: 11px !important; font-weight: 800 !important; text-shadow: none !important;
  }
  .swagger-ui .opblock.opblock-get { background: rgba(78, 182, 232, 0.16) !important; }
  .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #4eb6e8 !important; color: var(--af-navy-deep) !important; }
  .swagger-ui .opblock.opblock-post { background: rgba(78, 182, 232, 0.1) !important; }
  .swagger-ui .opblock.opblock-post .opblock-summary-method { background: var(--af-navy) !important; color: #fff !important; }
  .swagger-ui .opblock.opblock-put, .swagger-ui .opblock.opblock-patch { background: rgba(251, 191, 36, 0.16) !important; }
  .swagger-ui .opblock.opblock-put .opblock-summary-method, .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: #d97706 !important; color: #fff !important; }
  .swagger-ui .opblock.opblock-delete { background: rgba(248, 113, 113, 0.12) !important; }
  .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #b91c1c !important; color: #fff !important; }
  .swagger-ui .opblock .opblock-summary-path, .swagger-ui .opblock .opblock-summary-path__deprecated,
  .swagger-ui .opblock .opblock-summary-description { color: var(--af-navy) !important; }
  .swagger-ui .opblock-body { background: #fff !important; border-radius: 0 0 10px 10px; }
  .swagger-ui .opblock-body pre.microlight, .swagger-ui .highlight-code > pre {
    background: var(--af-navy-deep) !important; border-radius: 10px !important; padding: 12px 14px !important;
  }
  .swagger-ui pre code {
    background: transparent !important; padding: 0 !important; border-radius: 0 !important;
    color: inherit; font-size: 12px !important;
  }
  .swagger-ui .opblock-body pre.microlight, .swagger-ui .opblock-body pre.microlight span { line-height: 1.6 !important; }
  .swagger-ui .btn, .swagger-ui select, .swagger-ui input[type=text], .swagger-ui textarea {
    border-radius: 10px !important; font-family: Inter, ui-sans-serif, system-ui, sans-serif !important;
  }
  .swagger-ui .btn.authorize {
    color: #fff !important; border: 0 !important; box-shadow: none !important;
    background: linear-gradient(135deg, #1b4a73 0%, #2a5f8f 48%, #4eb6e8 100%) !important;
  }
  .swagger-ui .btn.authorize svg { fill: #fff !important; }
  .swagger-ui .btn.execute { background: var(--af-accent) !important; border-color: var(--af-accent) !important; color: var(--af-navy-deep) !important; font-weight: 700 !important; }
  .swagger-ui .btn.cancel { border-color: rgba(27, 74, 115, 0.2) !important; color: var(--af-navy) !important; }
  .swagger-ui .authorization__btn { fill: var(--af-navy) !important; }
  .swagger-ui .dialog-ux .modal-ux { border-radius: 16px !important; border: 1px solid var(--af-border) !important; }
  .swagger-ui .dialog-ux .modal-ux-header { border-bottom-color: var(--af-sky) !important; }
  .swagger-ui .dialog-ux .modal-ux-header h3 { color: var(--af-navy) !important; }
  @media (max-width: 640px) { .docs-nav .btn { width: 100%; } .swagger-ui .wrapper { padding: 0 12px 16px !important; } }
`;

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatUptime(totalSeconds: number): string {
  const s = Math.floor(totalSeconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function methodChip(method: string): string {
  return `<span class="method m-${method.toLowerCase()}">${escapeHtml(method)}</span>`;
}

@Injectable()
export class AppService {
  /** API home — ITSM `/api` layout. */
  getWelcomePage(doc: OpenAPIObject | null): string {
    const opCount = listOpenApiOperations(doc).length;
    const cards = API_LINKS.map(
      (link) => `<a class="card link-card" href="${link.href}">
          <strong>${escapeHtml(link.title)}</strong>
          <p>${escapeHtml(link.description)}</p>
          <small>${escapeHtml(link.href)}</small>
        </a>`,
    ).join('');

    const routes = COMMON_ROUTES.map(
      ([method, path]) =>
        `<li>${methodChip(method)}<span class="path">${escapeHtml(path)}</span></li>`,
    ).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  ${brandHead('Aceolution Finance API', HOME_CSS)}
</head>
<body class="bg-light">
  <main class="shell">
    ${brandMark()}
    <div class="home-head">
      <h1 class="title">API</h1>
      <span class="pill"><i></i> Online${opCount ? ` · ${opCount} routes` : ''}</span>
      <p class="lead">
        Same expense workflow as the web app. Sign in with <code>POST /auth/login</code>
        (demo accounts are in the Swagger examples), then send <code>Authorization: Bearer &lt;access_token&gt;</code>.
        Postman: <code>postman/Aceolution-Finance.postman_collection.json</code>.
      </p>
    </div>

    <div class="link-grid">${cards}</div>

    <section class="card routes-card">
      <h2>Common routes</h2>
      <ul class="route-list">${routes}</ul>
    </section>

    <div class="btn-row home-actions">
      <a class="btn btn-primary" href="${frontendUrl()}/">Open finance app</a>
      <a class="btn btn-outline" href="/status/unavailable">Server down page</a>
    </div>
  </main>
</body>
</html>`;
  }

  /** Swagger UI inside the brand shell — ITSM `/api/docs` layout. */
  getSwaggerPage(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  ${brandHead('Aceolution Finance API Docs', SWAGGER_CSS)}
  <link rel="stylesheet" href="/api/docs/assets/swagger-ui.css" />
</head>
<body class="bg-light">
  <main class="shell wide">
    ${brandMark()}
    <div class="home-head" style="margin-top:18px">
      <p class="kicker">Swagger UI</p>
      <h1 class="title">Aceolution Finance API</h1>
      <p class="lead">
        Same expense APIs as Postman. Run <code>POST /auth/login</code> (pick a demo account from the Examples dropdown),
        copy <code>access_token</code>, then click <strong>Authorize</strong>.
      </p>
    </div>
    <nav class="docs-nav">
      <a class="btn btn-primary" href="#swagger-ui">Try endpoints</a>
      <a class="btn btn-outline" href="/api/openapi">OpenAPI spec</a>
      <a class="btn btn-outline" href="/">API home</a>
      <a class="btn btn-outline" href="${frontendUrl()}/">Finance app</a>
    </nav>
    <div class="card docs-card">
      <div id="swagger-ui"></div>
    </div>
  </main>
  <script src="/api/docs/assets/swagger-ui-bundle.js"></script>
  <script>
    (function () {
      var root = document.documentElement;
      function keepLight() { if (root.classList.contains('dark-mode')) root.classList.remove('dark-mode'); }
      new MutationObserver(keepLight).observe(root, { attributes: true, attributeFilter: ['class'] });
      keepLight();
      window.ui = SwaggerUIBundle({
        url: '/api/docs-json',
        dom_id: '#swagger-ui',
        persistAuthorization: true,
        tryItOutEnabled: true,
        docExpansion: 'list',
        defaultModelsExpandDepth: -1,
        displayRequestDuration: true,
        filter: true,
      });
    })();
  </script>
</body>
</html>`;
  }

  /** Designed OpenAPI page — ITSM `/api/openapi` layout. */
  getOpenApiPage(doc: OpenAPIObject | null, baseUrl: string): string {
    const operations = listOpenApiOperations(doc);
    const tagInfo = new Map(
      (doc?.tags ?? []).map((t) => [t.name, t.description ?? '']),
    );
    const tags = [
      ...new Set([...tagInfo.keys(), ...operations.map((op) => op.tag)]),
    ].filter((tag) => operations.some((op) => op.tag === tag));

    const sections = tags
      .map((tag) => {
        const firstLine = (tagInfo.get(tag) ?? '')
          .split('\n')[0]
          .replace(/\*\*/g, '');
        const rows = operations
          .filter((op) => op.tag === tag)
          .map(
            (
              op,
            ) => `<li>${methodChip(op.method)}<span class="path">${escapeHtml(op.path)}</span>
              <span class="summary">${escapeHtml(op.summary)}${op.isPublic ? ' · public' : ''}</span></li>`,
          )
          .join('');
        return `<section class="card tag-section">
          <h2>${escapeHtml(tag)}</h2>
          ${firstLine ? `<p class="lead">${escapeHtml(firstLine)}</p>` : ''}
          <ul class="route-list">${rows}</ul>
        </section>`;
      })
      .join('');

    const json = doc ? JSON.stringify(doc, null, 2) : '{}';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  ${brandHead('OpenAPI spec · Aceolution Finance API', HOME_CSS)}
</head>
<body class="bg-light">
  <main class="shell">
    ${brandMark()}
    <div class="home-head">
      <p class="kicker">OpenAPI ${escapeHtml(doc?.openapi ?? '3.0')}</p>
      <h1 class="title">${escapeHtml(doc?.info.title ?? 'Aceolution Finance API')}</h1>
      <p class="lead">${escapeHtml(OPENAPI_SUMMARY)}</p>
      <p class="lead" style="margin-top:8px">Version ${escapeHtml(doc?.info.version ?? '1.0')} · ${escapeHtml(baseUrl)} · ${operations.length} routes</p>
    </div>

    <div class="btn-row home-actions">
      <a class="btn btn-primary" href="/api/docs">Open Swagger</a>
      <a class="btn btn-outline" href="/api/docs-json" download="aceolution-finance-openapi.json">Download JSON</a>
      <a class="btn btn-outline" href="/">API home</a>
    </div>

    <section class="card json-card" id="json">
      <div class="row">
        <h2>OpenAPI JSON</h2>
        <a class="btn btn-outline" href="/api/docs-json" download="aceolution-finance-openapi.json">Download JSON</a>
      </div>
      <pre>${escapeHtml(json)}</pre>
    </section>

    ${sections}
  </main>
</body>
</html>`;
  }

  /** Human status page — ITSM `/health` page. */
  getStatusPage(
    databaseUp: boolean,
    databaseState: string,
    refreshPath = '/health',
  ): string {
    const checks: StatusCheck[] = [
      { label: 'API process', value: 'Running', state: 'ok' },
      {
        label: 'Database (MongoDB)',
        value: databaseUp ? 'Connected' : capitalize(databaseState),
        state: databaseUp ? 'ok' : 'bad',
      },
      { label: 'Uptime', value: formatUptime(process.uptime()) },
      {
        label: 'Server time (UTC)',
        value: new Date().toISOString().replace('T', ' ').slice(0, 19),
      },
    ];
    const footnote =
      'Monitors and scripts get JSON from this same URL. <a href="/health?format=json">View JSON</a>';

    if (!databaseUp) {
      return renderStatusPage({
        code: '503',
        tone: 'rose',
        title: 'Database unavailable',
        description:
          'The API is running, but it cannot reach MongoDB. Check MONGODB_URI and the Atlas IP allowlist, then refresh.',
        icon: ICONS.serverOff,
        checks,
        footnote,
        actions: [
          { label: 'Refresh status', href: refreshPath, primary: true },
          { label: 'API home', href: '/' },
        ],
      });
    }
    return renderStatusPage({
      code: 'OK',
      tone: 'emerald',
      title: 'All systems up',
      description: 'The Aceolution Finance API and its database are reachable.',
      icon: ICONS.activity,
      checks,
      footnote,
      actions: [
        { label: 'Open API docs', href: '/api/docs', primary: true },
        { label: 'API home', href: '/' },
      ],
    });
  }
}
