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

- Auth: login, email OTP, optional TOTP authenticator, password change / forgot / reset, welcome emails
- Expense workflow: submit → approver approve/reject/request-changes → processor pay / partial-pay / reject
- Role-scoped data: `REQUESTER` | `APPROVER` | `PROCESSOR` | `ADMIN`
- Admin: users, categories, projects, countries
- FX conversion helpers
- File storage under Azure Blob folders `invoices` and `receipts`
- Demo seed: `POST /auth/seed`
- Health: `GET /` and `GET /health`
- Dashboard filtering (client-side): Project + `submittedAt` date range (From/To)

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your MongoDB, JWT, Azure, and optional SMTP values
```

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB Atlas URI (include `/ace_finance` database name) |
| `JWT_SECRET` | Yes | Long random secret for JWT signing |
| `PORT` | No | Default `3001` |
| `FRONTEND_URL` | Yes | Frontend origin for CORS + email links (e.g. `http://localhost:3000`) |
| `AZURE_STORAGE_CONNECTION_STRING` | Yes | Storage account connection string |
| `AZURE_STORAGE_CONTAINER` | Yes | Blob container name (e.g. `ace-finance-files`) |
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

- Frontend: sibling repo / folder `ace_finance_frontend`
- Live backend: https://ace-finance-api-f5hnhhd6c3bvffhj.southindia-01.azurewebsites.net/
- Live frontend: https://finance.aceolution.com/
