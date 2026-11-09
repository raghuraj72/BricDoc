# BricDoc Production Cloud Deployment Guide

This guide details how to deploy BricDoc's production architecture so that the live platform at **`https://bricdoc-raghuraj.vercel.app`** operates 24/7 completely independently of local development servers, Antigravity, or your computer.

---

## Architecture Overview

```
 ┌──────────────────────────────────────────────────────────────┐
 │                   Production Frontend                        │
 │           https://bricdoc-raghuraj.vercel.app                │
 │               (Hosted 24/7 on Vercel)                        │
 └──────────────────────────────┬───────────────────────────────┘
                                │ Proxies /api/v1/*
                                ▼
 ┌──────────────────────────────────────────────────────────────┐
 │               Persistent Cloud Backend API                   │
 │           Railway / Render (Permanent HTTPS)                 │
 │      FastAPI + PyMuPDF + Tesseract OCR + ReportLab           │
 └──────────────┬───────────────────────────────┬───────────────┘
                │                               │
                ▼                               ▼
 ┌──────────────────────────────┐ ┌─────────────────────────────┐
 │    Managed Database (SQL)    │ │   Private Object Storage    │
 │    PostgreSQL (Supabase/     │ │   Cloudflare R2 / Disk      │
 │       Neon / Railway)        │ │   AES-256 Vault Storage     │
 └──────────────────────────────┘ └─────────────────────────────┘
```

---

## 1. Deploy the Backend to Railway (Recommended - Fastest 1-Click)

Railway provides instant container deployment with permanent HTTPS, automatic health checks, and restart policies.

### Step 1: Open Railway
1. Go to [railway.app](https://railway.app/) and sign in with your GitHub account (`raghuraj72`).
2. Click **"+ New Project"** &rarr; **"Deploy from GitHub repo"**.
3. Select your repository: **`raghuraj72/BricDoc`**.

### Step 2: Configure Service Settings
1. Click on the newly created service tile &rarr; go to the **Settings** tab:
   - **Root Directory**: Leave as `/` (Railway will automatically detect `railway.json` and `backend/Dockerfile`).
   - Under **Networking**, click **"Generate Domain"**.
   - Railway will assign a permanent HTTPS URL, such as:
     `https://bricdoc-production.up.railway.app`

### Step 3: Add Production Environment Variables
In the **Variables** tab on Railway, add:
- `SECRET_KEY`: Any secure 32+ character random string (e.g. `bricdoc_prod_jwt_secret_key_2026_super_secure`).
- `CORS_ORIGINS`: `https://bricdoc-raghuraj.vercel.app,https://bricdoc.in`
- `APP_URL`: `https://bricdoc-raghuraj.vercel.app`
- `GEMINI_API_KEY`: *(Optional)* Your Google Gemini API Key for AI features.
- `RAZORPAY_KEY_ID`: *(Optional)* Your Razorpay Key ID (`rzp_test_...` or `rzp_live_...`).
- `RAZORPAY_KEY_SECRET`: *(Optional)* Your Razorpay Key Secret.
- `DATABASE_URL`: *(Optional)* If you add a Railway PostgreSQL plugin (click **+ New** &rarr; **Database** &rarr; **Add PostgreSQL**), Railway will automatically populate this variable!

Railway will build the Docker container and make your backend live within 2 minutes.

---

## 2. Deploy Backend to Render (Alternative Option)

1. Go to [dashboard.render.com](https://dashboard.render.com/) and click **"New +"** &rarr; **"Web Service"**.
2. Select your repository: **`raghuraj72/BricDoc`**.
3. Render automatically reads [`render.yaml`](./render.yaml).
4. Render will assign a permanent URL (e.g. `https://bricdoc-api.onrender.com`).
5. Add your environment variables in the Render Environment tab.

---

## 3. Connect Vercel Frontend to the Permanent Backend

Once you have your cloud backend URL (e.g., `https://bricdoc-production.up.railway.app` or `https://bricdoc-api.onrender.com`):

### Option A: Via Vercel CLI (Instant from terminal)
Run this command from your terminal:
```bash
npx vercel env rm BACKEND_INTERNAL_URL production --yes
npx vercel env add BACKEND_INTERNAL_URL production
# Paste: https://bricdoc-production.up.railway.app/api/v1

npx vercel env rm NEXT_PUBLIC_API_URL production --yes
npx vercel env add NEXT_PUBLIC_API_URL production
# Paste: https://bricdoc-production.up.railway.app/api/v1

# Redeploy production to apply:
npx vercel --prod
```

### Option B: Via Vercel Web Dashboard
1. Open your Vercel project: [vercel.com/raghuraj-pratap-singh/bricdoc/settings/environment-variables](https://vercel.com/raghuraj-pratap-singh/bricdoc/settings/environment-variables)
2. Edit or add the following variables for **Production** and **Preview**:
   - `BACKEND_INTERNAL_URL` = `https://<your-backend-domain>/api/v1`
   - `NEXT_PUBLIC_API_URL` = `https://<your-backend-domain>/api/v1`
3. Click **Save**.
4. Go to **Deployments** &rarr; click **Redeploy** on the latest production deployment.

---

## 4. Verification & Production Independence Test

Once redeployed:
1. Turn off your laptop, close VS Code, and close Antigravity.
2. Open `https://bricdoc-raghuraj.vercel.app` on your phone or any other independent device.
3. Verify:
   - Root Health: `https://<your-backend-domain>/health` returns `{"status":"healthy","service":"BricDoc API"}`.
   - All PDF Tools (Merge, Compress, Split, Convert) work seamlessly.
   - User registration and login succeed.
   - Cloud Document Vault uploads and displays files.
   - Razorpay Checkout loads genuine merchant orders.
