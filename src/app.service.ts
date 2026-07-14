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
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      font-family: "Plus Jakarta Sans", system-ui, sans-serif;
      color: #0f172a;
      background:
        radial-gradient(ellipse 80% 60% at 20% -10%, rgba(24, 80, 168, 0.12), transparent 55%),
        radial-gradient(ellipse 70% 50% at 90% 10%, rgba(32, 60, 98, 0.1), transparent 50%),
        #e8edf4;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
    }
    .card {
      width: 100%;
      max-width: 720px;
      background: #ffffff;
      border: 1.5px solid #64748b;
      border-radius: 20px;
      padding: 2rem;
      box-shadow: 0 12px 40px rgba(32, 60, 98, 0.1);
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: linear-gradient(90deg, #203c62, #1850a8, #70bcfc);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      margin-bottom: 1.25rem;
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
      margin: 1.1rem 0 1.5rem;
      padding: 0.45rem 0.9rem;
      border-radius: 999px;
      background: #d1fae5;
      border: 1.5px solid #34d399;
      color: #065f46;
      font-size: 0.875rem;
      font-weight: 700;
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
      padding: 0.95rem 1rem;
      border-radius: 12px;
      background: #f1f5f9;
      border: 1.5px solid #64748b;
    }
    .method {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
      margin-bottom: 0.45rem;
    }
    .get { background: #dbeafe; color: #1850a8; border: 1px solid #93c5fd; }
    .post { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
    .path {
      font-family: "IBM Plex Mono", ui-monospace, monospace;
      font-size: 0.9rem;
      font-weight: 700;
      color: #1850a8;
    }
    .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.8rem 1.15rem;
      border-radius: 12px;
      text-decoration: none;
      font-size: 0.9375rem;
      font-weight: 700;
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
        <h1>Aceolution <span class="accent">Finance</span> API</h1>
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
