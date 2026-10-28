# Aceolution Finance — Architecture Documentation

This folder is the **backend-repo copy** of the system architecture (diagrams, auth/Live–Demo, VAPT, PDF).  
The same files also live in `ace_finance_frontend/docs/Architecture/` so either git remote can recover them.

```
docs/Architecture/
├── Aceolution_Finance_Architecture.pdf
├── aceolution_finance_architecture.md
├── AUTH_LIVE_DEMO_STORES.md
├── templates/
├── scripts/
└── README.md
```

**Web page:** https://finance.aceolution.com/architecture/ (unlock via `/demo-guide/` first).  
Also summarized in https://finance.aceolution.com/docs-guide/#architecture  
PDF: https://finance.aceolution.com/architecture/Aceolution_Finance_Architecture.pdf

| Link | Path |
|------|------|
| Backend app README | [`../../README.md`](../../README.md) |
| Frontend twin copy | `ace_finance_frontend/docs/Architecture/` (sibling repo) |
| Frontend README | sibling `ace_finance_frontend/README.md` |

---

## Key Artifacts

1. [**`Aceolution_Finance_Architecture.pdf`**](./Aceolution_Finance_Architecture.pdf)
   - Multi-page dark-theme PDF with Mermaid diagrams.

2. [**`aceolution_finance_architecture.md`**](./aceolution_finance_architecture.md)
   - Full system specification (stack, dual Mongo/blob, security).

3. [**`AUTH_LIVE_DEMO_STORES.md`**](./AUTH_LIVE_DEMO_STORES.md)
   - Microsoft-first login · Demo Access · password · Choose Workspace · Live/Demo isolation · VAPT notes.

4. [**`VAPT_SCOPE.md`**](./VAPT_SCOPE.md)
   - Formal VAPT engagement brief: targets, in/out of scope, Microsoft ROE, pre-flight checklist.

5. [**`BACKUP_AND_RESTORE.md`**](./BACKUP_AND_RESTORE.md)
   - Full package: Atlas DB backup, Azure blob soft delete/versioning, App Service backup, restore drills.

---

## Sign-in flow (summary)

1. **Sign in with Microsoft** (company staff)  
2. **Demo Access** (dynamic `isDemo` list → demo DB/files only)  
3. **Use password instead** (admin / no Microsoft → OTP/TOTP when required)  
4. **Choose Workspace** if email exists in Live and Demo (role shown per store)  
5. Dashboard shows **Live** or **Demo** badge  

---

## Re-generate the PDF

From the **backend** repo root:

```bash
node docs/Architecture/scripts/build-exact-pdf.cjs
```

When you edit architecture docs, update **both** frontend and backend `docs/Architecture` copies.
