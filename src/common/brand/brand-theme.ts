/**
 * Shared look for the backend's HTML pages (API home, Swagger, OpenAPI, status pages).
 * Layout and colours follow the Aceolution ITSM portal (navy #1B4A73 + cyan #4EB6E8).
 */

export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function frontendUrl(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(
    /\/$/,
    '',
  );
}

export const BRAND_CSS = `
  :root {
    --af-navy: #1b4a73;
    --af-navy-deep: #0e2a45;
    --af-navy-mid: #2a5f8f;
    --af-accent: #4eb6e8;
    --af-ice: #f0f8fc;
    --af-sky: #e4f3fb;
    --af-text: #12324e;
    --af-muted: #5b7a90;
    --af-subtle: #94a3b8;
    --af-border: rgba(78, 182, 232, 0.18);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body {
    color: var(--af-text);
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  a { color: inherit; }
  :not(pre) > code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.85em;
    background: var(--af-sky);
    border-radius: 6px;
    padding: 1px 6px;
  }
  .bg-light { background: linear-gradient(135deg, #f0f8fc 0%, #e4f3fb 55%, #f7fbfd 100%); min-height: 100dvh; }
  .bg-dark {
    background: linear-gradient(160deg, #0e2a45 0%, #1b4a73 48%, #2a5f8f 78%, #4eb6e8 140%);
    min-height: 100dvh;
  }
  .shell { max-width: 768px; margin: 0 auto; padding: 32px 16px 48px; }
  .shell.wide { max-width: 980px; }

  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { width: 48px; height: 48px; border-radius: 10px; object-fit: contain; background: #fff; }
  .brand.center { flex-direction: column; gap: 10px; text-align: center; }
  .wordmark { display: block; font-size: 18px; font-weight: 800; letter-spacing: -0.03em; color: var(--af-navy); }
  .wordmark span { color: var(--af-accent); }
  .eyebrow { display: block; font-size: 13px; font-weight: 600; letter-spacing: 0.08em; color: #5b7a90; }

  .kicker { margin: 0; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--af-subtle); }
  .title { margin: 4px 0 0; font-size: 30px; font-weight: 800; letter-spacing: -0.03em; color: var(--af-navy); }
  .lead { margin: 12px 0 0; max-width: 620px; font-size: 14px; line-height: 1.65; color: var(--af-muted); }

  .card {
    border: 1px solid var(--af-border);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.82);
    box-shadow: 0 4px 24px rgba(27, 74, 115, 0.07);
    backdrop-filter: blur(16px);
    padding: 20px;
  }
  .card h2 { margin: 0; font-size: 14px; font-weight: 600; color: var(--af-navy); }

  .btn-row { display: flex; flex-wrap: wrap; gap: 12px; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center;
    min-height: 40px; padding: 0 16px; border-radius: 10px;
    font: 600 14px/1 Inter, ui-sans-serif, system-ui, sans-serif;
    text-decoration: none; cursor: pointer; white-space: nowrap;
    transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
  }
  .btn:hover { transform: translateY(-1px); }
  .btn-primary {
    color: #fff; border: 0;
    background: linear-gradient(135deg, #1b4a73 0%, #2a5f8f 48%, #4eb6e8 100%);
    box-shadow: 0 4px 12px rgba(27, 74, 115, 0.28);
  }
  .btn-outline { color: var(--af-navy); background: #fff; border: 1.5px solid rgba(27, 74, 115, 0.16); }
  .btn-outline:hover { border-color: var(--af-accent); background: var(--af-ice); }
  .btn-primary:hover { background: linear-gradient(135deg, #0e2a45 0%, #1b4a73 42%, #4eb6e8 100%); box-shadow: 0 6px 18px rgba(27, 74, 115, 0.38); }
  ::selection { background: rgba(78, 182, 232, 0.35); color: #0e2a45; }

  .method {
    display: inline-flex; align-items: center; justify-content: center;
    width: 68px; height: 28px; flex-shrink: 0; border-radius: 6px;
    font-size: 11px; font-weight: 800; letter-spacing: 0.02em;
  }
  .m-get { background: rgba(78, 182, 232, 0.22); color: var(--af-navy); }
  .m-post { background: rgba(78, 182, 232, 0.14); color: var(--af-navy); }
  .m-put, .m-patch { background: rgba(251, 191, 36, 0.18); color: #b45309; }
  .m-delete { background: rgba(248, 113, 113, 0.15); color: #b91c1c; }

  @media (max-width: 640px) {
    .shell { padding: 24px 14px 40px; }
    .title { font-size: 24px; }
    .btn-row { flex-direction: column; }
    .btn { width: 100%; }
  }
`;

export function brandHead(title: string, extraCss = ''): string {
  return `<meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="icon" type="image/png" href="/Ace_logo_small.png" />
  <link rel="apple-touch-icon" href="/Ace_logo_small.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>${BRAND_CSS}${extraCss}</style>`;
}

export function brandMark(center = false): string {
  return `<div class="brand${center ? ' center' : ''}">
      <img src="/Ace_logo_small.png" alt="Aceolution" />
      <div>
        <strong class="wordmark">Aceo<span>lution</span></strong>
        <span class="eyebrow">FINANCE</span>
      </div>
    </div>`;
}

const svg = (paths: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

/** Lucide icons (same set the ITSM status pages use). */
export const ICONS = {
  activity: svg(
    '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  ),
  serverOff: svg(
    '<path d="M7 2h13a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-5"/><path d="M10 10 2.5 2.5C2 2 2 2.5 2 5v3a2 2 0 0 0 2 2h6z"/><path d="M22 17v-1a2 2 0 0 0-2-2h-1"/><path d="M4 14a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16.5l1-.5.5.5-8-8H4z"/><path d="M6 18h.01"/><path d="m2 2 20 20"/>',
  ),
  fileQuestion: svg(
    '<path d="M12 17h.01"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3"/>',
  ),
  alert: svg(
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  ),
};
