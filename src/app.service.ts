import { Injectable } from '@nestjs/common';

type ApiRoute = { method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string };

const API_ROUTE_GROUPS: Array<{ title: string; routes: ApiRoute[] }> = [
  {
    title: 'Auth',
    routes: [
      { method: 'POST', path: '/auth/login' },
      { method: 'POST', path: '/auth/verify-2fa' },
      { method: 'POST', path: '/auth/resend-otp' },
      { method: 'GET', path: '/auth/totp/status' },
      { method: 'POST', path: '/auth/totp/setup' },
      { method: 'POST', path: '/auth/totp/enable' },
      { method: 'POST', path: '/auth/totp/disable/send-code' },
      { method: 'POST', path: '/auth/totp/disable' },
      { method: 'POST', path: '/auth/change-password' },
      { method: 'POST', path: '/auth/forgot-password' },
      { method: 'POST', path: '/auth/reset-password' },
      { method: 'GET', path: '/auth/validate-reset-token' },
      { method: 'POST', path: '/auth/seed' },
    ],
  },
  {
    title: 'Users',
    routes: [
      { method: 'GET', path: '/users' },
      { method: 'POST', path: '/users' },
      { method: 'GET', path: '/users/me' },
      { method: 'PUT', path: '/users/me' },
      { method: 'PUT', path: '/users/:id' },
      { method: 'DELETE', path: '/users/:id' },
    ],
  },
  {
    title: 'Expenses',
    routes: [
      { method: 'POST', path: '/expenses' },
      { method: 'GET', path: '/expenses' },
      { method: 'GET', path: '/expenses/stats' },
      { method: 'GET', path: '/expenses/mine' },
      { method: 'GET', path: '/expenses/:id' },
      { method: 'GET', path: '/expenses/:id/invoice' },
      { method: 'GET', path: '/expenses/:id/payment-receipt/:fileName' },
      { method: 'PUT', path: '/expenses/:id' },
      { method: 'PATCH', path: '/expenses/:id/approve' },
      { method: 'PATCH', path: '/expenses/:id/reject' },
      { method: 'PATCH', path: '/expenses/:id/request-changes' },
      { method: 'PATCH', path: '/expenses/:id/process' },
      { method: 'PATCH', path: '/expenses/:id/partial-pay' },
      { method: 'PATCH', path: '/expenses/:id/processor-reject' },
      { method: 'DELETE', path: '/expenses/:id' },
    ],
  },
  {
    title: 'Catalog',
    routes: [
      { method: 'GET', path: '/categories/active' },
      { method: 'GET', path: '/categories' },
      { method: 'POST', path: '/categories' },
      { method: 'PUT', path: '/categories/:id' },
      { method: 'DELETE', path: '/categories/:id' },
      { method: 'GET', path: '/projects/active' },
      { method: 'GET', path: '/projects' },
      { method: 'POST', path: '/projects' },
      { method: 'PUT', path: '/projects/:id' },
      { method: 'DELETE', path: '/projects/:id' },
      { method: 'GET', path: '/countries/active' },
      { method: 'GET', path: '/countries' },
      { method: 'POST', path: '/countries' },
      { method: 'PUT', path: '/countries/:id' },
      { method: 'DELETE', path: '/countries/:id' },
    ],
  },
  {
    title: 'FX',
    routes: [{ method: 'GET', path: '/fx/convert' }],
  },
];

@Injectable()
export class AppService {
  private methodClass(method: ApiRoute['method']): string {
    return method.toLowerCase();
  }

  private renderRoutes(): string {
    return API_ROUTE_GROUPS.map(
      (group) => `
      <section class="group">
        <h2 class="group-title">${group.title}</h2>
        <div class="grid">
          ${group.routes
            .map(
              (route, index) => `
            <div class="endpoint" style="--i:${index}">
              <span class="method ${this.methodClass(route.method)}">${route.method}</span>
              <div class="path">${route.path}</div>
            </div>`,
            )
            .join('')}
        </div>
      </section>`,
    ).join('');
  }

  getWelcomePage(): string {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const routeCount = API_ROUTE_GROUPS.reduce((n, g) => n + g.routes.length, 0);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aceolution Finance API</title>
  <link rel="icon" type="image/png" href="/Ace_logo_small.png" />
  <link rel="apple-touch-icon" href="/Ace_logo_small.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }
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
      align-items: flex-start;
      justify-content: center;
      padding: 2rem 1rem;
    }
    @keyframes bgDrift {
      from { background-position: 0% 0%, 100% 0%, center; }
      to { background-position: 20% 10%, 80% 15%, center; }
    }
    .card {
      width: 100%;
      max-width: 960px;
      background: #ffffff;
      border: 1.5px solid #64748b;
      border-radius: 20px;
      padding: 2rem;
      box-shadow: 0 12px 40px rgba(32, 60, 98, 0.1);
      position: relative;
      overflow: hidden;
      animation: cardIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
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
    .brand {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      margin-bottom: 1.25rem;
      animation: fadeUp 0.55s ease 0.1s both;
    }
    .logo {
      width: 52px;
      height: 52px;
      border-radius: 12px;
      background: #f1f5f9;
      border: 1.5px solid #94a3b8;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
      animation: logoPop 0.7s cubic-bezier(0.34, 1.4, 0.64, 1) 0.15s both;
    }
    @keyframes logoPop {
      from { opacity: 0; transform: scale(0.7) rotate(-6deg); }
      to { opacity: 1; transform: scale(1) rotate(0deg); }
    }
    .logo img {
      display: block;
      width: 42px;
      height: 42px;
      object-fit: contain;
    }
    h1 {
      font-size: 1.55rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #0f172a;
    }
    h1 .accent { color: #1850a8; }
    .subtitle {
      color: #334155;
      margin-top: 0.35rem;
      font-size: 0.95rem;
      font-weight: 500;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin: 1.1rem 0 1.25rem;
      padding: 0.45rem 0.9rem;
      border-radius: 999px;
      background: #d1fae5;
      border: 1.5px solid #34d399;
      color: #065f46;
      font-size: 0.875rem;
      font-weight: 700;
      animation: fadeUp 0.55s ease 0.2s both;
    }
    .dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #059669;
      box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.25);
      animation: pulse 1.8s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.25); }
      50% { opacity: 0.7; transform: scale(0.88); box-shadow: 0 0 0 6px rgba(5, 150, 105, 0.12); }
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .meta {
      margin: 0 0 1.25rem;
      color: #475569;
      font-size: 0.875rem;
      font-weight: 600;
      animation: fadeUp 0.55s ease 0.28s both;
    }
    .group {
      margin-bottom: 1.25rem;
      animation: fadeUp 0.55s ease both;
    }
    .group:nth-of-type(1) { animation-delay: 0.32s; }
    .group:nth-of-type(2) { animation-delay: 0.4s; }
    .group:nth-of-type(3) { animation-delay: 0.48s; }
    .group:nth-of-type(4) { animation-delay: 0.56s; }
    .group:nth-of-type(5) { animation-delay: 0.64s; }
    .group-title {
      font-size: 0.8rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #475569;
      margin-bottom: 0.55rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 0.65rem;
    }
    .endpoint {
      padding: 0.8rem 0.9rem;
      border-radius: 12px;
      background: #f1f5f9;
      border: 1.5px solid #64748b;
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease;
      animation: endpointIn 0.45s ease both;
      animation-delay: calc(0.35s + (var(--i, 0) * 0.035s));
    }
    @keyframes endpointIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .endpoint:hover {
      transform: translateY(-2px);
      background: #ffffff;
      border-color: #1850a8;
      box-shadow: 0 8px 18px rgba(24, 80, 168, 0.12);
    }
    .method {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      padding: 0.2rem 0.45rem;
      border-radius: 6px;
      margin-bottom: 0.4rem;
    }
    .get { background: #dbeafe; color: #1850a8; border: 1px solid #93c5fd; }
    .post { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
    .put { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
    .patch { background: #ede9fe; color: #5b21b6; border: 1px solid #c4b5fd; }
    .delete { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    .path {
      font-family: "IBM Plex Mono", ui-monospace, monospace;
      font-size: 0.8rem;
      font-weight: 700;
      color: #1850a8;
      word-break: break-all;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      animation: fadeUp 0.55s ease 0.72s both;
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
    .btn-primary {
      background: #203c62;
      color: #ffffff;
    }
    .btn-primary:hover { background: #2a4d78; }
    .btn-secondary {
      background: #ffffff;
      color: #0f172a;
      border: 1.5px solid #64748b;
    }
    .btn-secondary:hover { background: #f1f5f9; }
    .footer {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1.5px solid #94a3b8;
      color: #334155;
      font-size: 0.875rem;
      font-weight: 500;
      animation: fadeUp 0.55s ease 0.8s both;
    }
    @media (max-width: 720px) {
      body { padding: 1rem 0.75rem; }
      .card { padding: 1.25rem 1rem; border-radius: 16px; }
      .brand { align-items: flex-start; gap: 0.7rem; }
      h1 { font-size: 1.25rem; }
      .subtitle { font-size: 0.88rem; }
      .grid { grid-template-columns: 1fr; }
      .actions { flex-direction: column; align-items: stretch; }
      .btn { width: 100%; min-height: 44px; justify-content: center; }
      .path { font-size: 0.74rem; }
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="brand">
      <div class="logo">
        <img src="/Ace_logo_small.png" alt="Aceolution" />
      </div>
      <div>
        <h1>Aceolution <span class="accent">Finance</span> API</h1>
        <p class="subtitle">Expense approval backend — running and ready</p>
      </div>
    </div>

    <div class="status"><span class="dot"></span> API Online</div>
    <p class="meta">${routeCount} routes across Auth, Users, Expenses, Catalog, and FX</p>

    ${this.renderRoutes()}

    <div class="actions">
      <a class="btn btn-primary" href="${frontendUrl}/" target="_blank" rel="noreferrer">Open Frontend App</a>
      <a class="btn btn-secondary" href="${frontendUrl}/login/" target="_blank" rel="noreferrer">Dashboard Login</a>
    </div>

    <p class="footer">JSON API only — use the frontend at port 3000 for the full UI.</p>
  </main>
</body>
</html>`;
  }
}
