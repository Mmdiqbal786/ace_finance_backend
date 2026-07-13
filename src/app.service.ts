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
  <title>Ace Finance API</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      font-family: Inter, system-ui, -apple-system, sans-serif;
      color: #fff;
      background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
    }
    .card {
      width: 100%;
      max-width: 720px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 2rem;
      backdrop-filter: blur(16px);
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.35);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      margin-bottom: 1.5rem;
    }
    .logo {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 1rem;
      box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
    }
    h1 { font-size: 1.75rem; font-weight: 800; letter-spacing: -0.02em; }
    h1 span { color: #a5b4fc; }
    .subtitle { color: rgba(255,255,255,0.55); margin-top: 0.35rem; font-size: 0.95rem; }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin: 1.25rem 0 1.75rem;
      padding: 0.45rem 0.85rem;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #6ee7b7;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #34d399;
      box-shadow: 0 0 12px #34d399;
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
      margin-bottom: 1.75rem;
    }
    .endpoint {
      padding: 0.9rem 1rem;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .method {
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      padding: 0.2rem 0.45rem;
      border-radius: 6px;
      margin-bottom: 0.45rem;
    }
    .get { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }
    .post { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }
    .path { font-family: ui-monospace, monospace; font-size: 0.82rem; color: #e4e4e7; }
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
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .btn:hover { transform: translateY(-1px); }
    .btn-primary {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff;
      box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.06);
      color: #d4d4d8;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
    .footer {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.35);
      font-size: 0.75rem;
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="brand">
      <div class="logo">AF</div>
      <div>
        <h1>Ace<span>Finance</span> API</h1>
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
