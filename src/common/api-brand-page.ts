export type BrandPageAction = {
  label: string;
  href: string;
  primary?: boolean;
};

export type BrandPageOptions = {
  title: string;
  badge: string;
  badgeTone?: 'ok' | 'warn' | 'error';
  heading: string;
  message: string;
  detail?: string;
  actions?: BrandPageAction[];
};

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Shared branded HTML shell for API status / error pages. */
export function renderBrandPage(options: BrandPageOptions): string {
  const tone = options.badgeTone || 'error';
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const actions = options.actions?.length
    ? options.actions
    : [
        { label: 'API Home', href: '/', primary: true },
        { label: 'Open Frontend', href: `${frontendUrl}/`, primary: false },
      ];

  const actionsHtml = actions
    .map(
      (a) =>
        `<a class="btn ${a.primary ? 'btn-primary' : 'btn-secondary'}" href="${escapeHtml(a.href)}">${escapeHtml(a.label)}</a>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(options.title)} · Aceolution Finance API</title>
  <link rel="icon" type="image/png" href="/Ace_logo_small.png" />
  <link rel="apple-touch-icon" href="/Ace_logo_small.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation: none !important; transition: none !important; }
    }
    body {
      min-height: 100vh;
      font-family: "Plus Jakarta Sans", system-ui, sans-serif;
      color: #0f172a;
      background:
        radial-gradient(ellipse 80% 60% at 20% -10%, rgba(24, 80, 168, 0.12), transparent 55%),
        radial-gradient(ellipse 70% 50% at 90% 10%, rgba(32, 60, 98, 0.1), transparent 50%),
        #e8edf4;
      background-size: 140% 140%, 140% 140%, auto;
      animation: bgDrift 18s ease-in-out infinite alternate;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
    }
    @keyframes bgDrift {
      from { background-position: 0% 0%, 100% 0%, center; }
      to { background-position: 20% 10%, 80% 15%, center; }
    }
    .card {
      width: 100%;
      max-width: 560px;
      background: #ffffff;
      border: 1.5px solid #64748b;
      border-radius: 20px;
      padding: 2rem;
      box-shadow: 0 12px 40px rgba(32, 60, 98, 0.1);
      position: relative;
      overflow: hidden;
      animation: cardIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
      text-align: center;
    }
    @keyframes cardIn {
      from { opacity: 0; transform: translateY(18px) scale(0.985); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .card::before {
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: linear-gradient(90deg, #203c62, #1850a8, #70bcfc, #1850a8, #203c62);
      background-size: 200% 100%;
      animation: barShine 4.5s linear infinite;
    }
    @keyframes barShine {
      from { background-position: 0% 0; }
      to { background-position: 200% 0; }
    }
    .logo {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      background: #f1f5f9;
      border: 1.5px solid #94a3b8;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1rem;
      animation: logoPop 0.7s cubic-bezier(0.34, 1.4, 0.64, 1) 0.1s both;
    }
    @keyframes logoPop {
      from { opacity: 0; transform: scale(0.7) rotate(-6deg); }
      to { opacity: 1; transform: scale(1) rotate(0deg); }
    }
    .logo img { width: 42px; height: 42px; object-fit: contain; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      margin: 0 0 1rem;
      padding: 0.4rem 0.85rem;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 700;
      animation: fadeUp 0.55s ease 0.15s both;
    }
    .badge.ok { background: #d1fae5; border: 1.5px solid #34d399; color: #065f46; }
    .badge.warn { background: #fef3c7; border: 1.5px solid #fcd34d; color: #92400e; }
    .badge.error { background: #fee2e2; border: 1.5px solid #fca5a5; color: #991b1b; }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
      animation: pulse 1.8s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.55; transform: scale(0.85); }
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    h1 {
      font-size: 1.55rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #0f172a;
      animation: fadeUp 0.55s ease 0.22s both;
    }
    h1 .accent { color: #1850a8; }
    .message {
      margin-top: 0.75rem;
      color: #334155;
      font-size: 0.98rem;
      font-weight: 500;
      line-height: 1.5;
      animation: fadeUp 0.55s ease 0.3s both;
    }
    .detail {
      margin-top: 0.85rem;
      padding: 0.75rem 0.9rem;
      border-radius: 10px;
      background: #f1f5f9;
      border: 1.5px solid #94a3b8;
      font-family: "IBM Plex Mono", ui-monospace, monospace;
      font-size: 0.8rem;
      font-weight: 600;
      color: #1850a8;
      word-break: break-word;
      animation: fadeUp 0.55s ease 0.38s both;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      justify-content: center;
      margin-top: 1.5rem;
      animation: fadeUp 0.55s ease 0.45s both;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.8rem 1.15rem;
      border-radius: 12px;
      text-decoration: none;
      font-size: 0.9375rem;
      font-weight: 700;
      transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
    }
    .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(32, 60, 98, 0.15); }
    .btn-primary { background: #203c62; color: #ffffff; }
    .btn-primary:hover { background: #2a4d78; }
    .btn-secondary { background: #ffffff; color: #0f172a; border: 1.5px solid #64748b; }
    .btn-secondary:hover { background: #f1f5f9; }
    .footer {
      margin-top: 1.35rem;
      padding-top: 1rem;
      border-top: 1.5px solid #94a3b8;
      color: #64748b;
      font-size: 0.8rem;
      font-weight: 500;
      animation: fadeUp 0.55s ease 0.52s both;
    }
    @media (max-width: 640px) {
      body { padding: 1rem 0.75rem; align-items: flex-start; }
      .card { padding: 1.35rem 1.1rem; border-radius: 16px; }
      h1 { font-size: 1.3rem; }
      .message { font-size: 0.92rem; }
      .detail { font-size: 0.72rem; text-align: left; }
      .actions { flex-direction: column; align-items: stretch; }
      .btn { width: 100%; min-height: 44px; }
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="logo">
      <img src="/Ace_logo_small.png" alt="Aceolution" />
    </div>
    <div class="badge ${tone}"><span class="dot"></span> ${escapeHtml(options.badge)}</div>
    <h1>${options.heading}</h1>
    <p class="message">${escapeHtml(options.message)}</p>
    ${options.detail ? `<p class="detail">${escapeHtml(options.detail)}</p>` : ''}
    <div class="actions">${actionsHtml}</div>
    <p class="footer">Aceolution Finance API</p>
  </main>
</body>
</html>`;
}

export function renderNotFoundPage(path: string): string {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  return renderBrandPage({
    title: '404 Not Found',
    badge: '404 · Not Found',
    badgeTone: 'warn',
    heading: 'Page <span class="accent">not found</span>',
    message: 'This API route does not exist. Check the path or go back to the API home.',
    detail: `Cannot GET ${path}`,
    actions: [
      { label: 'API Home', href: '/', primary: true },
      { label: 'Open Frontend', href: `${frontendUrl}/` },
      { label: 'Dashboard Login', href: `${frontendUrl}/login/` },
    ],
  });
}

export function renderServerErrorPage(statusCode: number, message: string, detail?: string): string {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const isDown = statusCode === 502 || statusCode === 503 || statusCode === 504;
  return renderBrandPage({
    title: isDown ? 'Service Unavailable' : `Error ${statusCode}`,
    badge: isDown ? `${statusCode} · Service Unavailable` : `${statusCode} · Server Error`,
    badgeTone: 'error',
    heading: isDown
      ? 'API temporarily <span class="accent">unavailable</span>'
      : 'Something went <span class="accent">wrong</span>',
    message: isDown
      ? 'The Aceolution Finance API could not complete this request. Please try again in a moment.'
      : message || 'An unexpected error occurred while processing your request.',
    detail: detail || message,
    actions: [
      { label: 'API Home', href: '/', primary: true },
      { label: 'Open Frontend', href: `${frontendUrl}/` },
      { label: 'Try again', href: 'javascript:location.reload()' },
    ],
  });
}
