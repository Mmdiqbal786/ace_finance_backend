# Aceolution Finance — Backend

NestJS API for Aceolution Finance: expense spend management, auth (JWT + 2FA), user/admin config, file uploads, and transactional email.

## Stack

- **NestJS 11** + TypeScript
- **MongoDB** (Mongoose)
- **JWT / Passport** auth
- **Azure Blob Storage** — invoice & payment receipt files
- **Azure Communication Services Email** (preferred) — with optional Resend / Gmail SMTP fallback
- Node.js `>=20 <23`

## Features

- Auth: Microsoft Entra SSO, password + email OTP / TOTP, Demo Access, Live/Demo workspace choice, password change / forgot / reset (password accounts), welcome emails
- **Live vs Demo stores:** separate MongoDB DBs (`ace_finance` / `ace_finance_demo`) + Azure containers; JWT `store` claim routes every request
- Expense workflow: submit → approver approve/reject/request-changes → processor pay / partial-pay / reject
- Role-scoped data: `REQUESTER` | `APPROVER` | `PROCESSOR` | `ADMIN`
- **Project assignment:** Requester and Approver must have one or more `assignedProjects` (Admin create/edit). Requesters submit only those projects; Approvers only see/act on (and get emails / due-soon reminders for) expenses in their assigned projects. Admin and Processor are not project-scoped.
- **Demo Access:** dynamic `GET /auth/demo-accounts` + `POST /auth/demo-login` for active `isDemo` users in the demo DB (Admin toggles in Demo workspace → Users)
- Admin: users, categories, projects, countries
- FX conversion helpers
- File storage under Azure Blob folders `invoices` and `receipts` (live vs demo containers)
- Demo seed: `POST /auth/seed` (and boot seed for both stores)
- Health: `GET /` and `GET /health` (reports live + demo Mongo)
- Dashboard filtering (client-side): Project + `submittedAt` date range (From/To)
- In-app notifications per user (same audience as workflow emails), with unread count API — frontend bell may be temporarily hidden while APIs remain available

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your MongoDB, JWT, Azure, and optional SMTP values
```

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | Live MongoDB Atlas URI (database `ace_finance`) |
| `MONGODB_URI_DEMO` | Recommended | Demo MongoDB URI (database `ace_finance_demo`; same cluster OK) |
| `JWT_SECRET` | Yes | Long random secret for JWT signing |
| `PORT` | No | Default `3001` |
| `FRONTEND_URL` | Yes | Frontend origin for CORS + email + Microsoft redirects (e.g. `http://localhost:3000`) |
| `AZURE_STORAGE_CONNECTION_STRING` | Yes | Storage account connection string |
| `AZURE_STORAGE_CONTAINER` | Yes | Live blob container (e.g. `ace-finance-files`) |
| `AZURE_STORAGE_CONTAINER_DEMO` | Recommended | Demo blob container (e.g. `ace-finance-files-demo`) |
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` | For Microsoft login | Entra app registration |
| `AZURE_REDIRECT_URI` | For Microsoft login | Must match Entra redirect, e.g. `…/auth/microsoft/callback` |
| `ALLOWED_EMAIL_DOMAIN` | Optional | Default `*aceolution*` for new Microsoft users |
| `AZURE_COMMUNICATION_CONNECTION_STRING` | Recommended | ACS connection string (`endpoint=…;accesskey=…`) |
| `AZURE_EMAIL_SENDER` | With ACS | Verified sender, e.g. `DoNotReply@….azurecomm.net` |
| `SMTP_*` | Optional | Gmail/SMTP fallback when Azure Email is not set |
| `RESEND_API_KEY` | Optional | Resend HTTPS fallback (used if set and Azure Email is not) |

### Mail priority

1. **Azure Communication Email** (if connection string + sender are set)
2. **Resend** (if `RESEND_API_KEY` is set)
3. **SMTP** (`SMTP_HOST` / `USER` / `PASS`)

On hosts that block outbound SMTP, use Azure Email or Resend (HTTPS).

### Azure Email setup (short)

1. Create **Communication Service** → copy Keys connection string  
2. Create **Email Communication Service** → Provision domains → add Azure subdomain (or custom domain)  
3. Connect that domain to the Communication Service  
4. Set `AZURE_EMAIL_SENDER` to the MailFrom address (usually `DoNotReply@….azurecomm.net`)

## Run

```bash
# development (watch)
npm run start:dev

# production build
npm run build
npm run start:prod
```

API base: `http://localhost:3001`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Nest watch mode |
| `npm run build` | Compile to `dist/` |
| `npm run start` / `start:prod` | Run compiled app |
| `npm run lint` | ESLint |
| `npm test` | Unit tests |

## Related

- Frontend: sibling folder `ace_finance_frontend` (separate git remote)
- **Architecture (committed in this repo — safe if you only keep the backend clone):**
  - [Index](./docs/Architecture/README.md)
  - [Full system architecture](./docs/Architecture/aceolution_finance_architecture.md)
  - [Auth + Live/Demo stores + VAPT](./docs/Architecture/AUTH_LIVE_DEMO_STORES.md)
  - [Architecture PDF](./docs/Architecture/Aceolution_Finance_Architecture.pdf)
- Same docs are also in `ace_finance_frontend/docs/Architecture/` (keep both in sync)
- Live backend: https://ace-finance-api-f5hnhhd6c3bvffhj.southindia-01.azurewebsites.net/
- Live frontend: https://finance.aceolution.com/
