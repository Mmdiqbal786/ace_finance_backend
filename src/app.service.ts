import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getWelcomePage(): string {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aceolution Finance API</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      color: #203c62;
      background:
        radial-gradient(ellipse 80% 60% at 20% -10%, rgba(14, 165, 233, 0.12), transparent 55%),
        radial-gradient(ellipse 70% 50% at 90% 10%, rgba(32, 60, 98, 0.08), transparent 50%),
        #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
    }
    .card {
      width: 100%;
      max-width: 720px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 2rem;
      box-shadow: 0 12px 40px rgba(32, 60, 98, 0.08);
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: #203c62;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      margin-bottom: 1.25rem;
    }
    .logo {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }
    .logo img {
      display: block;
      width: 40px;
      height: 40px;
      object-fit: contain;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #203c62;
    }
    .subtitle {
      color: #64748b;
      margin-top: 0.25rem;
      font-size: 0.9rem;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin: 1.1rem 0 1.5rem;
      padding: 0.4rem 0.8rem;
      border-radius: 999px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #047857;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
      animation: pulse 1.8s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.55; transform: scale(0.85); }
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    .endpoint {
      padding: 0.85rem 1rem;
      border-radius: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }
    .method {
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      padding: 0.2rem 0.45rem;
      border-radius: 6px;
      margin-bottom: 0.4rem;
    }
    .get { background: #e0f2fe; color: #0369a1; }
    .post { background: #ecfdf5; color: #047857; }
    .path {
      font-family: ui-monospace, "Cascadia Code", monospace;
      font-size: 0.82rem;
      color: #203c62;
    }
    .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.75rem 1.1rem;
      border-radius: 12px;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 600;
      transition: background 0.15s ease, transform 0.15s ease;
    }
    .btn:hover { transform: translateY(-1px); }
    .btn-primary {
      background: #203c62;
      color: #ffffff;
    }
    .btn-primary:hover { background: #2a4d78; }
    .btn-secondary {
      background: #ffffff;
      color: #203c62;
      border: 1px solid #cbd5e1;
    }
    .btn-secondary:hover { background: #f1f5f9; }
    .footer {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid #e2e8f0;
      color: #94a3b8;
      font-size: 0.75rem;
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="brand">
      <div class="logo">
        <img src="${frontendUrl}/Ace_logo_small.png" alt="Aceolution" />
      </div>
      <div>
        <h1>Aceolution Finance API</h1>
        <p class="subtitle">Expense approval backend — running and ready</p>
      </div>
    </div>

    <div class="status"><span class="dot"></span> API Online</div>

    <div class="grid">
      <div class="endpoint">
        <span class="method post">POST</span>
        <div class="path">/auth/login</div>
      </div>
      <div class="endpoint">
        <span class="method get">GET</span>
        <div class="path">/expenses</div>
      </div>
      <div class="endpoint">
        <span class="method get">GET</span>
        <div class="path">/expenses/stats</div>
      </div>
      <div class="endpoint">
        <span class="method get">GET</span>
        <div class="path">/users</div>
      </div>
    </div>

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
