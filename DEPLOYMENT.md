# BricDoc Production Cloud Deployment & Render Migration Guide

This guide details the complete production architecture, Render Blueprint migration protocol, and service configuration for **BricDoc** ([bricdoc-raghuraj.vercel.app](https://bricdoc-raghuraj.vercel.app/)), enabling the entire platform to operate 24/7 independently of Antigravity, local development servers, laptops, and temporary tunnels.

---

## 1. Render Production Architecture Overview

The platform is declared in [`render.yaml`](./render.yaml) as a unified Render Blueprint:

```
                            ┌────────────────────────────────────────┐
                            │           bricdoc-frontend             │
                            │        (Render Web Service)            │
                            │      Node.js 20+ / Next.js 15          │
                            └───────────────────┬────────────────────┘
                                                │ Proxies /api/v1/* (Internal Mesh)
                                                ▼
                            ┌────────────────────────────────────────┐
                            │             bricdoc-api                │
                            │        (Render Web Service)            │
                            │    FastAPI + Uvicorn (Port 10000)      │
                            └───────┬───────────┬────────────┬───────┘
                                    │           │            │
             ┌──────────────────────┘           │            └──────────────────────┐
             │                                  │                                   │
             ▼                                  ▼                                   ▼
┌─────────────────────────┐        ┌─────────────────────────┐        ┌──────────────────────────┐
│       bricdoc-db        │        │      bricdoc-redis      │        │      bricdoc-worker      │
│  (Managed PostgreSQL)   │        │   (Render Key-Value)    │        │ (Render Background Worker│
│ PostgreSQL 16 standard  │        │ Job Queue & Cache       │        │  Asynchronous PDF Tasks) │
└─────────────────────────┘        └─────────────────────────┘        └─────────────┬────────────┘
                                                                                    │
                                                                                    ▼
                                                                      ┌──────────────────────────┐
                                                                      │    Vault Object Storage  │
                                                                      │  Cloudflare R2 / Disk    │
                                                                      │  AES-256 Encrypted Docs  │
                                                                      └──────────────────────────┘
```

---

## 2. Render Blueprint Specification (`render.yaml`)

Our [`render.yaml`](./render.yaml) automatically orchestrates 5 independent services and databases:

1. **`bricdoc-frontend` (Web Service)**:
   - **Runtime**: `node` (Node.js 20+)
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Routing**: Automatically proxies `/api/v1/*` requests over Render's internal private mesh to `bricdoc-api`.

2. **`bricdoc-api` (Web Service)**:
   - **Runtime**: `docker`
   - **Build Context**: `.` (Repository root)
   - **Dockerfile**: `./backend/Dockerfile`
   - **Port**: Dynamically reads `$PORT` (Render default `10000`).
   - **Health Check**: `/health` (verifies process, PostgreSQL, Redis, storage, and worker heartbeat).
   - **Persistent Storage**: 10 GB persistent disk mounted at `/app/vault_storage`.

3. **`bricdoc-worker` (Background Worker)**:
   - **Runtime**: `docker`
   - **Command**: `python -m app.worker`
   - **Tasks**: Long-running asynchronous execution of Merge, Split, Compress, Convert, Protect, Unlock, Watermark, Redact, OCR, and Repair.
   - **Queue**: Durable Redis list (`bricdoc:jobs:queue`) with automatic database fallback.
   - **Heartbeat**: Emits status every 15s to `/health` probes.

4. **`bricdoc-db` (Managed Database)**:
   - **Engine**: Managed PostgreSQL 16.
   - **Automated Provisioning**: Credentials and `DATABASE_URL` are injected directly into `bricdoc-api` and `bricdoc-worker`.
   - **Connection Pooling**: SQLAlchemy pool (`pool_size=10`, `max_overflow=20`) with automatic `postgres://` to `postgresql://` normalization.

5. **`bricdoc-redis` (Key-Value Queue & Cache)**:
   - **Engine**: Managed Redis / Key Value instance on Render.
   - **Internal Access**: Bound to private service mesh with zero public exposure.

---

## 3. Step-by-Step Render Deployment (2 Minutes)

### Step 1: Open Render Dashboard
1. Go to [dashboard.render.com](https://dashboard.render.com/).
2. Click the blue **"New +"** button in the top navigation bar.
3. Select **"Blueprint"**.

### Step 2: Connect the GitHub Repository
1. Select your GitHub repository: **`raghuraj72/BricDoc`** (Branch: `main`).
2. Render will parse [`render.yaml`](./render.yaml) and display the execution plan:
   - Web Service: `bricdoc-api`
   - Background Worker: `bricdoc-worker`
   - Web Service: `bricdoc-frontend`
   - Database: `bricdoc-db`
   - Key Value: `bricdoc-redis`

### Step 3: Enter Optional Environment Secrets
Render will ask for any sync-false secrets:
- `GEMINI_API_KEY`: *(Optional)* Your Google Gemini API Key for document Q&A.
- `RAZORPAY_KEY_ID`: *(Optional)* Your Razorpay Key ID (`rzp_live_...` or `rzp_test_...`).
- `RAZORPAY_KEY_SECRET`: *(Optional)* Your Razorpay Key Secret.
- `R2_BUCKET_NAME` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`: *(Optional)* For Cloudflare R2 bucket.

### Step 4: Click "Apply"
Render will provision the PostgreSQL database and Redis instance, build the backend Docker container, build the Next.js frontend, and launch the worker.

---

## 4. Verification Protocol

Once Render finishes deploying:

1. **Verify Backend Health:**
   ```bash
   curl -s https://<your-bricdoc-api>.onrender.com/health
   ```
   Expected response:
   ```json
   {
     "status": "healthy",
     "service": "BricDoc API",
     "version": "1.0.0",
     "components": {
       "database": "connected",
       "storage": "accessible",
       "redis": "connected",
       "worker": "active"
     }
   }
   ```

2. **Verify Frontend:**
   Open `https://<your-bricdoc-frontend>.onrender.com`.
   - Test PDF Merge, Compress, and Protect tools.
   - Register a new user and log in.
   - Upload and retrieve documents from the private Cloud Vault.

3. **Verify Payments:**
   Navigate to `/pricing` &rarr; click **"Claim Pro for $1 (₹85)"** &rarr; verify Razorpay order creates with genuine tax breakdown (18% GST).

---

## 5. Monthly Hosting Cost Estimate

Render pricing for this architecture:

| Service / Resource | Plan | Specs | Monthly Cost |
| :--- | :--- | :--- | :--- |
| **`bricdoc-api`** | Starter | 0.5 CPU, 512 MB RAM, 10 GB Disk | ~$7.00 |
| **`bricdoc-worker`** | Starter | 0.5 CPU, 512 MB RAM, 10 GB Disk | ~$7.00 |
| **`bricdoc-frontend`** | Starter | 0.5 CPU, 512 MB RAM | ~$7.00 |
| **`bricdoc-db`** | Starter | 0.25 CPU, 1 GB RAM, 10 GB Storage | ~$7.00 (Free for 30 days) |
| **`bricdoc-redis`** | Starter | 25 MB RAM, In-memory queue | ~$5.00 (Free for 30 days) |
| **Total** | | | **~$26.00 – $33.00 / month** |

*(Note: Free tiers can also be selected for development and testing).*

---

## 6. Rollback Plan

If you ever wish to revert or keep Vercel active alongside Render:
- The existing Vercel deployment at `https://bricdoc-raghuraj.vercel.app` remains fully operational.
- You can route Vercel's proxy directly to your Render backend API by setting `BACKEND_INTERNAL_URL = https://<your-bricdoc-api>.onrender.com/api/v1` in [Vercel Project Settings](https://vercel.com/raghuraj-pratap-singh/bricdoc/settings/environment-variables).
