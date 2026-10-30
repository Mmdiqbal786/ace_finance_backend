/**
 * Swagger / Postman — How & Why guide for the frontend + mobile teams.
 * Shown at the top of /api/docs and reused by postman/lib/generate-collection.mjs.
 */

export const API_GUIDE_MARKDOWN = `
# Aceolution Finance API — How & Why

## End-to-end flow
\`\`\`
Requester submits expense (+ invoice)  →  PENDING_APPROVER
  → Approver approves                  →  APPROVED_APPROVER
  → Processor partial pay (optional)   →  PARTIALLY_PAID
  → Processor pays the rest (+ receipt) →  PROCESSED
Side paths: reject (REJECTED_APPROVER / REJECTED_PROCESSOR) · request changes (CHANGES_REQUESTED → requester edits → PENDING_APPROVER)
\`\`\`

---

## Authentication
| Why | How |
|-----|-----|
| Every protected API needs a JWT | Bearer \`access_token\` (Postman **Authorize**). Prefer Demo Access / Microsoft over password for staff. |
| Company staff | \`GET /auth/microsoft/login\` → Entra → callback → optional \`POST /auth/select-workspace\` |
| Training personas (demo DB) | Unlock with \`DEMO_ACCESS_CODE\` → \`POST /auth/demo-login\` (+ header \`X-Demo-Access-Code\`) → JWT \`store: demo\` |
| Password admin / non-Microsoft | \`POST /auth/login\` → may return 2FA challenge or workspace choice |
| Account has 2FA (email OTP / authenticator) | Login returns \`requires2fa: true\` + \`challengeToken\` → \`POST /auth/verify-2fa\` → \`access_token\` |
| Dual Live+Demo email | \`requiresWorkspaceChoice\` + \`workspaceToken\` → \`POST /auth/select-workspace\` \`{ store: "live"|"demo" }\` |
| Code didn't arrive | \`POST /auth/resend-otp\` with the same \`challengeToken\` |
| First login with temporary password | \`user.mustChangePassword = true\` → \`POST /auth/change-password\` (returns a fresh token) |
| Non-admin without authenticator | \`user.mustSetupTotp = true\` → \`POST /auth/totp/setup\` → scan QR → \`POST /auth/totp/enable\` |

**Demo Access personas (password only — no OTP):** Requester \`requester.gac@acefinance.com\` / \`Requester@1234\` · Approver \`approver.media@acefinance.com\` / \`Approver@1234\` · Processor \`alisha.processor@acefinance.com\` / \`Processor@1234\` · Admin password \`finance@aceolution.com\` / \`Admin@1234\` (then pick Live or Demo).

**Automated checks:** \`npm run test:api:vapt\` (API) · frontend \`npm run test:e2e\` (Playwright). Live Swagger \`/api/docs\` is **off** in production (\`ENABLE_API_DOCS=false\`).

---

## Roles
| Role | Can do |
|------|--------|
| REQUESTER | Submit (assigned projects only), view own requests, edit / resubmit after changes are requested |
| APPROVER | Approve / reject / request changes — **only assigned projects** (list is filtered) |
| PROCESSOR | Partial pay, mark paid, reject at payment, send back to approver (all projects) |
| ADMIN | Everything + users, projects, categories, countries |

---

## Expense request form
| Why | How |
|-----|-----|
| Dropdowns | \`GET /projects/active\` · \`GET /categories/active\` · \`GET /countries/active\` (**Bearer required**) |
| Show USD preview while typing | \`GET /fx/convert?currency=INR&amount=1500\` (**Bearer required**) |
| Submit | \`POST /expenses\` — **Bearer** + **multipart/form-data**, file field \`invoice\` (PDF / JPG / PNG / WEBP / GIF, max 5 MB). Requester comes from JWT (body email ignored). |
| View one expense | \`GET /expenses/{id}\` (**Bearer**; peer / missing → **404**, no existence oracle) |

**Send:** \`category\` = category **name**, \`project\` = project **name**, \`country\` = country **name**. Server converts \`originalAmount\` to USD (\`amount\`) at today's rate (min ~$1 USD).

---

## Dashboard
| Why | How |
|-----|-----|
| Cards + charts | \`GET /expenses/stats\` (scoped like the list) |
| Table | \`GET /expenses\` (approvers only see assigned projects) · requester: \`GET /expenses/mine\` |
| View files | \`GET /expenses/{id}/invoice\` · \`GET /expenses/{id}/payment-receipt/{fileName}\` (binary, Bearer) |

---

## Approver / Processor actions
| Why | How |
|-----|-----|
| Approve / reject | \`PATCH /expenses/{id}/approve\` · \`/reject\` with \`{ notes }\` (status must be PENDING_APPROVER) |
| Send back | \`PATCH /expenses/{id}/request-changes\` \`{ notes, target }\` — \`requester\` or (processor only) \`approver\` |
| Partial payout | \`PATCH /expenses/{id}/partial-pay\` multipart: \`amount\` (USD) + \`receipt\` file |
| Pay remaining | \`PATCH /expenses/{id}/process\` multipart: \`receipt\` file (+ \`notes\`) |
| Reject at payment | \`PATCH /expenses/{id}/processor-reject\` \`{ notes }\` |

---

## Requester edit / resubmit
| Why | How |
|-----|-----|
| Replace invoice (optional, first) | \`PATCH /expenses/{id}/invoice\` multipart \`invoice\` — status stays CHANGES_REQUESTED |
| Fix fields + resubmit | \`PUT /expenses/{id}\` (JSON fields) → status returns to PENDING_APPROVER |

Both only work while status is **CHANGES_REQUESTED** (requester: own requests; admin: any).

---

## Admin
| Why | How |
|-----|-----|
| Users | \`GET/POST /users\` · \`PUT/DELETE /users/{id}\` — omit \`password\` on create to email a temporary one |
| Catalogs | \`GET/POST /projects\`, \`/categories\`, \`/countries\` · \`PUT/DELETE /{id}\` (Mongo \`_id\`) |

---

## Responses
Success bodies are returned **as-is** (no envelope) — see **Responses → Example Value** on each endpoint.

Errors (JSON clients):
\`\`\`json
{ "statusCode": 400, "message": "Cannot approve expense. Current status is PROCESSED", "error": "Bad Request" }
\`\`\`

| Code | Meaning |
|------|---------|
| 200 / 201 | Success (POST = 201) |
| 400 | Bad request / business rule (wrong status, missing file, bad code) |
| 401 | Missing or invalid Bearer token / wrong password |
| 403 | Signed in but role or project not allowed |
| 404 | Expense / user / record not found |
`.trim();

/** Per-tag short How/Why for DocumentBuilder.addTag (also used as Postman folder descriptions). */
export const SWAGGER_TAG_DESCRIPTIONS: Record<string, string> = {
  Authentication:
    '**Why:** Get a JWT for protected APIs and manage 2FA / passwords. **How:** POST /auth/login → (2FA accounts) POST /auth/verify-2fa → Authorize with access_token.',
  Expenses:
    '**Why:** The expense request lifecycle — submit, track, approve, pay. **How:** POST /expenses (multipart) → PATCH approve → PATCH partial-pay / process (multipart receipt).',
  Users:
    '**Why:** Profile + admin user management. **How:** GET/PUT /users/me for self; ADMIN uses /users CRUD with role + assignedProjects.',
  Projects:
    '**Why:** Project dropdown + approver/requester scoping. **How:** GET /projects/active (Bearer); ADMIN CRUD on /projects.',
  Categories:
    '**Why:** Expense category dropdown. **How:** GET /categories/active (Bearer); ADMIN CRUD on /categories.',
  Countries:
    '**Why:** Country dropdown + currency for USD conversion. **How:** GET /countries/active (Bearer); ADMIN CRUD on /countries.',
  Notifications:
    '**Why:** In-app bell for workflow events. **How:** GET /notifications + /unread-count → PATCH /{id}/read or /read-all.',
  FX: "**Why:** Live USD preview on the request form. **How:** GET /fx/convert?currency=INR&amount=1500 (Bearer; today's rate).",
  Health:
    '**Why:** Liveness probe for uptime monitors. **How:** GET /health (public, no auth).',
};

/** Format Why / How / When for @ApiOperation descriptions. */
export function howWhy(opts: {
  why: string;
  how: string;
  when?: string;
  extras?: string;
}) {
  const parts = [`**Why:** ${opts.why}`, '', `**How:** ${opts.how}`];
  if (opts.when) parts.push('', `**When:** ${opts.when}`);
  if (opts.extras) parts.push('', opts.extras);
  return parts.join('\n');
}
