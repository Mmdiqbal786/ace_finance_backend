import {
  ICONS,
  brandHead,
  brandMark,
  escapeHtml,
  frontendUrl,
} from './brand/brand-theme';

export type StatusTone = 'slate' | 'sky' | 'emerald' | 'amber' | 'rose';

export type StatusAction = {
  label: string;
  href: string;
  primary?: boolean;
};

export type StatusCheck = {
  label: string;
  value: string;
  state?: 'ok' | 'bad' | 'info';
};

export type StatusPageOptions = {
  title: string;
  description: string;
  code?: string;
  tone?: StatusTone;
  icon?: string;
  meta?: string;
  detail?: string;
  checks?: StatusCheck[];
  actions?: StatusAction[];
  footnote?: string;
};

const STATUS_CSS = `
  .status-wrap { display: flex; min-height: 100dvh; align-items: center; justify-content: center; padding: 40px 16px; }
  .status-card {
    width: 100%; max-width: 420px; border-radius: 20px; background: #fff;
    padding: 36px; box-shadow: 0 25px 60px rgba(14, 42, 69, 0.35);
  }
  .status-card .brand { margin-bottom: 20px; }
  .tone { display: inline-flex; width: 48px; height: 48px; align-items: center; justify-content: center; border-radius: 16px; }
  .tone-slate { background: var(--af-sky); color: var(--af-navy); }
  .tone-sky { background: rgba(78, 182, 232, 0.22); color: var(--af-navy); }
  .tone-emerald { background: rgba(52, 211, 153, 0.15); color: #065f46; }
  .tone-amber { background: rgba(251, 191, 36, 0.15); color: #b45309; }
  .tone-rose { background: rgba(248, 113, 113, 0.15); color: #b91c1c; }
  .status-code { margin: 16px 0 0; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--af-subtle); }
  .status-meta { margin: 12px 0 0; font-size: 14px; color: #5b7a90; }
  .status-card h1 { margin: 8px 0 0; font-size: 28px; font-weight: 800; letter-spacing: -0.03em; color: var(--af-navy); }
  .status-desc { margin: 12px 0 0; font-size: 14px; line-height: 1.65; color: var(--af-muted); }
  .status-detail {
    margin: 14px 0 0; padding: 10px 12px; border-radius: 10px; background: var(--af-sky);
    font: 600 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: var(--af-navy); word-break: break-word;
  }
  .status-card .btn-row { margin-top: 32px; }
  .checks { list-style: none; margin: 20px 0 0; padding: 0; border-radius: 12px; background: var(--af-ice); border: 1px solid var(--af-border); }
  .checks li { display: flex; align-items: center; gap: 10px; padding: 11px 14px; font-size: 13px; }
  .checks li + li { border-top: 1px solid var(--af-border); }
  .checks .label { color: var(--af-muted); }
  .checks .value { margin-left: auto; font-weight: 600; color: var(--af-navy); text-align: right; }
  .checks .dot { width: 8px; height: 8px; flex-shrink: 0; border-radius: 50%; background: var(--af-subtle); }
  .checks .ok .dot { background: #10b981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.18); }
  .checks .bad .dot { background: #ef4444; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.18); }
  .checks .bad .value { color: #b91c1c; }
  .checks .info .dot { background: var(--af-accent); }
  .footnote { margin: 18px 0 0; font-size: 12px; color: var(--af-subtle); }
  .footnote a { color: var(--af-navy-mid); }
  @media (max-width: 640px) { .status-card { padding: 24px; } .status-card h1 { font-size: 24px; } }
`;

/** ITSM-style status card on the dark brand gradient (health, 503, 404, 500). */
export function renderStatusPage(options: StatusPageOptions): string {
  const tone = options.tone ?? 'slate';
  const actions = options.actions?.length
    ? options.actions
    : [{ label: 'API home', href: '/', primary: true }];

  const actionsHtml = actions
    .map(
      (a) =>
        `<a class="btn ${a.primary ? 'btn-primary' : 'btn-outline'}" href="${escapeHtml(a.href)}">${escapeHtml(a.label)}</a>`,
    )
    .join('');

  const checksHtml = options.checks?.length
    ? `<ul class="checks">${options.checks
        .map(
          (c) =>
            `<li class="${c.state ?? 'info'}"><span class="dot"></span><span class="label">${escapeHtml(c.label)}</span><span class="value">${escapeHtml(c.value)}</span></li>`,
        )
        .join('')}</ul>`
    : '';

  const icon =
    options.icon ?? `<strong>${escapeHtml(options.code?.[0] ?? '!')}</strong>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${brandHead(`${options.title} · Aceolution Finance API`, STATUS_CSS)}
</head>
<body class="bg-dark">
  <main class="status-wrap">
    <div class="status-card">
      ${brandMark(true)}
      <div class="tone tone-${tone}">${icon}</div>
      ${options.code ? `<p class="status-code">${escapeHtml(options.code)}</p>` : ''}
      ${options.meta ? `<p class="status-meta">${escapeHtml(options.meta)}</p>` : ''}
      <h1>${escapeHtml(options.title)}</h1>
      <p class="status-desc">${escapeHtml(options.description)}</p>
      ${options.detail ? `<p class="status-detail">${escapeHtml(options.detail)}</p>` : ''}
      ${checksHtml}
      <div class="btn-row">${actionsHtml}</div>
      ${options.footnote ? `<p class="footnote">${options.footnote}</p>` : ''}
    </div>
  </main>
</body>
</html>`;
}

export function renderUnavailablePage(): string {
  return renderStatusPage({
    code: '503',
    tone: 'rose',
    title: 'Service unavailable',
    description:
      'The Aceolution Finance API or its database is temporarily down. Please wait a moment and try again.',
    icon: ICONS.serverOff,
    actions: [
      { label: 'Check status', href: '/health' },
      { label: 'Back to app', href: `${frontendUrl()}/`, primary: true },
    ],
  });
}

export function renderNotFoundPage(path: string): string {
  return renderStatusPage({
    code: '404',
    tone: 'sky',
    title: 'Page not found',
    description:
      'This API route does not exist. Check the path, or open the API docs for every route.',
    detail: `Cannot GET ${path}`,
    icon: ICONS.fileQuestion,
    actions: [
      { label: 'API home', href: '/', primary: true },
      { label: 'API docs', href: '/api/docs' },
    ],
  });
}

export function renderServerErrorPage(
  statusCode: number,
  message: string,
  detail?: string,
): string {
  const isDown = statusCode === 502 || statusCode === 503 || statusCode === 504;
  if (isDown) return renderUnavailablePage();
  return renderStatusPage({
    code: String(statusCode),
    tone: statusCode >= 500 ? 'rose' : 'amber',
    title: statusCode >= 500 ? 'Something went wrong' : 'Request failed',
    description:
      message || 'An unexpected error occurred while processing your request.',
    detail,
    icon: ICONS.alert,
    actions: [
      { label: 'API home', href: '/', primary: true },
      { label: 'Check status', href: '/health' },
    ],
  });
}
