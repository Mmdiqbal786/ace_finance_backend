# Aceolution Finance — Backup & restore (full package)

Last updated: 2026-10-28  
Owner: Aceolution Finance team  

AWS “snapshot” equivalent for this stack is **not** a single Azure Disk snapshot. Data lives in three places that must be protected separately.

| Layer | Resource | Backup mechanism |
|-------|----------|------------------|
| Database | MongoDB Atlas (`ace_finance` + `ace_finance_demo`) | Atlas **Cloud Backup** / Continuous / PITR |
| Files | Storage account `acefinance` containers `ace-finance-files` + `ace-finance-files-demo` | Blob **soft delete** + **versioning** (+ optional copy) |
| API config | App Service `ace-finance-api` | App Service **Backup** (code stays in git) |
| Frontend | Static Web App `ace-finance-frontend` | **Git** only |

---

## 1. MongoDB Atlas (highest priority)

If `ace-finance-db` in Azure is a Marketplace link to Atlas, open the real cluster in [cloud.mongodb.com](https://cloud.mongodb.com) (same project as `MONGODB_URI`).

### Enable / verify Cloud Backup

1. Atlas → your **Project** → **Clusters** → select the cluster used by Ace Finance.  
2. **Backup** (or **…** → **Edit Configuration** → Backup).  
3. Turn on **Cloud Backup** (M10+ typically; M0 free tier has **no** continuous backup — upgrade if needed for production).  
4. Prefer **Continuous Cloud Backup** / **Point in Time Restore** if the tier allows.  
5. Retention (recommended start):
   - Snapshots: keep **7 daily** + **4 weekly** (or Atlas default Continuous window).  
   - Confirm both databases exist: `ace_finance` (Live) and `ace_finance_demo` (Demo). One cluster backup covers both DBs.

### Test restore (do this once)

1. Atlas → **Backup** → pick a snapshot → **Restore**.  
2. Prefer restore to a **new temporary cluster** or restore **only** `ace_finance` into a scratch DB name — never overwrite Live on first test.  
3. Point a staging App Service slot / local `.env` at the restore URI and verify login + one expense + invoice open.  
4. Document the restore time and who approved it.

### Ops checklist

- [ ] Cloud Backup enabled on production cluster  
- [ ] Alert email set for backup failures (Atlas Project → Alerts)  
- [ ] Quarterly restore drill recorded  

---

## 2. Azure Storage account `acefinance` (invoices + receipts)

Portal: **Home** → search **`acefinance`** → Storage account.

### Soft delete (blobs)

1. Storage account → **Data protection** (or **Data management** → **Data protection**).  
2. Enable **Soft delete for blobs**.  
3. Retention: **14–30 days** (recommend **30** for finance files).  
4. Save.

### Blob versioning

1. Same **Data protection** blade.  
2. Enable **Versioning for blobs**.  
3. Save.

### Soft delete for containers (optional but recommended)

1. Enable **Soft delete for containers** (same blade if available).  
2. Retention: match blob soft delete (e.g. **30** days).

### Verify containers

Under **Containers**, confirm both exist and stay private:

- `ace-finance-files` (Live)  
- `ace-finance-files-demo` (Demo)  

### Optional: scheduled copy (extra safety)

For a second copy in another account/region (disaster region):

1. Create a second storage account (e.g. `acefinancebackup`) in another region.  
2. Use **Object replication** or **AzCopy** scheduled job to sync both containers nightly.  
3. Keep soft delete + versioning on the backup account too.

### Restore a deleted / overwritten blob

1. Container → open blob → **Versions** / **Show deleted blobs**.  
2. Select prior version or undelete soft-deleted blob.  
3. Confirm the expense still points at the same `fileName` in Mongo (filenames are stable in app code).

---

## 3. App Service `ace-finance-api` (optional config snapshot)

Portal: **Home** → **`ace-finance-api`**.

1. **Settings** → **Backup** (or **Backups**).  
2. Configure:
   - Storage account: prefer a dedicated backup container on `acefinance` or `acefinancebackup` (e.g. `app-service-backups`).  
   - Frequency: **Daily**.  
   - Retention: **7–14** days.  
3. Include connection strings / app settings as offered.  
4. **Note:** App code should already be redeployable from git; this backup is mainly for **App Settings** recovery and quick slot restore.

### Restore

1. Backups blade → select backup → **Restore**.  
2. Prefer restore to a **staging slot** first, then swap.

---

## 4. Frontend Static Web App

No Azure disk snapshot.

- Source of truth: git remotes for `ace_finance_frontend`.  
- Recovery: redeploy last known good commit / SWA deployment history.  

---

## 5. What a “full snapshot day” looks like

| Time | Action |
|------|--------|
| Continuous | Atlas continuous backup (if enabled) |
| Daily | Atlas snapshot + App Service backup |
| Always on | Blob soft delete + versioning |
| Quarterly | Restore drill: DB scratch + one blob undelete |

### Minimum RPO / RTO targets (suggested)

| Data | RPO | RTO |
|------|-----|-----|
| Mongo Live | ≤ 1 hour (PITR) or last snapshot | Few hours with staging verify |
| Blobs | Minutes (version/soft delete) | Minutes for single file |
| API config | 24 hours | Redeploy + restore settings |

---

## 6. Azure portal quick path (from your subscription)

Logged in as `iqbal@aceolution.com`:

1. **Home** → open resource group **`ace-finance`**.  
2. Open **`acefinance`** → Data protection → soft delete + versioning.  
3. Open **`ace-finance-api`** → Backup → configure daily.  
4. Open Atlas (via **`ace-finance-db`** SaaS link or cloud.mongodb.com) → Backup → Cloud Backup / PITR.  

Do **not** use Azure “Disk snapshot” unless you later add VMs — this app does not run on managed disks today.

---

## 7. After setup — confirm

- [ ] Soft-delete a test blob in `ace-finance-files-demo` and undelete it  
- [ ] Atlas shows successful backup jobs  
- [ ] App Service backup job Succeeded once  
- [ ] `DEMO_ACCESS_CODE` / secrets remain only in App Settings / Atlas / Key Vault — never in git  
