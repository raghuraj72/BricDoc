# BricDoc — Everything your documents need. One intelligent workspace.

![BricDoc Platform](https://img.shields.io/badge/Platform-BricDoc%20v1.0-4f46e5?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%2B%20Python%203.14-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015%20App%20Router-black?style=for-the-badge&logo=next.js&logoColor=white)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel&logoColor=white)
![Tests](https://img.shields.io/badge/Automated%20Tests-20%2F20%20Passing-success?style=for-the-badge)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fraghuraj72%2FBricDoc&root-directory=frontend&env=NEXT_PUBLIC_API_URL&envDescription=Public%20Backend%20API%20URL%20(e.g.%20https%3A%2F%2Fbricdoc-api.onrender.com%2Fapi%2Fv1))

BricDoc is a production-grade, all-in-one document productivity platform. It combines full-fidelity PDF manipulation, bidirectional office conversions, grounded AI document analysis with verifiable page citations, private cloud vault storage, and a structured path to a published Google Play Store Android app.

---

## Architecture Overview

```
BricDoc/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI entrypoint, CORS, global exception handler
│   │   ├── core/                       # Settings, database, JWT security, private storage
│   │   ├── models/                     # SQLAlchemy models (User, Document, Job, Workflow, AI, Audit)
│   │   ├── schemas/                    # Pydantic v2 schemas for all requests/responses
│   │   ├── services/                   # Document processors (pypdf, pymupdf, reportlab, PIL, docx, openpyxl, AI)
│   │   └── api/v1/                     # Versioned REST API endpoints (52 registered routes)
│   ├── tests/                          # Automated Pytest suite (19 passing unit & integration tests)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/                        # Next.js 15 App Router pages (Home, Tools, Editor, AI, Vault, Auth, Settings)
│   │   ├── components/                 # UI components, Logo, ToolWorkspace, PDFEditorCanvas, AIWorkspaceView
│   │   └── lib/                        # API client, auth context, tool registry, formatting utilities
│   ├── package.json
│   ├── tailwind.config.ts
│   └── Dockerfile
├── mobile/
│   ├── capacitor.config.ts             # Android Capacitor 7 configuration (com.bricdoc.app)
│   └── README.md                       # Android build, release keystore signing, Play Store submission guide
├── docker-compose.yml                  # Production stack (Frontend, Backend, PostgreSQL, Redis)
├── .env.example                        # Environment variable template
├── FEATURE_STATUS.md                   # Real-time implementation and test verification matrix
└── README.md
```

---

## 1. Quick Start (Windows PowerShell)

### Prerequisites
- Python 3.12+ (tested with Python 3.14)
- Node.js 18+ (tested with Node.js v24)
- npm 10+ (tested with npm 11)

### Fast One-Command Startup
To start both BricDoc frontend and backend on dedicated, collision-free ports:
```powershell
python start_services.py
```
This automatically verifies and launches:
- **Web Platform:** [http://localhost:3005/](http://localhost:3005/)
- **Interactive OpenAPI Documentation:** [http://127.0.0.1:8005/api/v1/docs](http://127.0.0.1:8005/api/v1/docs)
- **Health Check Endpoint:** [http://127.0.0.1:8005/health](http://127.0.0.1:8005/health)

*(Using dedicated ports 3005/8005 prevents any conflicts with other local desktop servers running on ports 3000/8000).*

### Manual Startup (If Preferred)
**Backend:**
```powershell
python backend/run_backend.py
```
**Frontend:**
```powershell
cd frontend
npm run start
```
Open your browser to: [http://localhost:3005/](http://localhost:3005/)

---

## 2. Running Automated Tests

### Comprehensive Pytest Suite
Execute the automated backend test suite covering PDF operations, conversions, AES encryption, redaction, and API authentication:
```powershell
$env:PYTHONPATH="backend"
pytest backend/tests -v
```
**Test Results:**
```
======================= 20 passed in 52.65s =======================
```

### Full Live System Verification (7 Domains)
Run the live integration suite testing live HTTP responses across health, authentication, private vault, all core PDF engines, format conversions (including user's real `.docx`), AI document intelligence, and multi-step custom workflows:
```powershell
python backend/tests/test_live_system.py
```
**Output:**
```
>>> ALL 7 SYSTEM DOMAINS PASSED FULL LIVE VERIFICATION! <<<
```

Verify the frontend production build:
```powershell
cd frontend
npm run build
```
Result: 21 static and dynamic pages generated with 0 errors.

---

## 3. Production Deployment with Docker Compose

To run the complete production stack (Next.js, FastAPI, PostgreSQL, Redis) with one command:
```powershell
# Copy environment configuration
cp .env.example .env

# Build and start all containers in detached mode
docker compose up --build -d
```
All persistent document vaults and database tables will be mounted to Docker volumes automatically.

---

## 4. Key Platform Features

### Core PDF Tools
- **Merge PDF:** Combine multiple documents with custom ordering.
- **Split PDF:** Extract page ranges (e.g., `1-3, 5`) or split all pages into a ZIP archive.
- **Compress PDF:** Resample images and deflate content streams with real percentage reduction calculations.
- **Page Numbers:** Insert numbers (`Page X of Y`) positioned at bottom-center, top-right, etc.
- **Rotate & Crop:** 90° clockwise increments and margin boundary trimming.

### Document Conversions
- **PDF to DOCX:** Editable Microsoft Word output.
- **DOCX to PDF:** Clean document formatting and paragraph styling.
- **PDF to Images / Images to PDF:** High-DPI page rendering and multi-image compilation.
- **PDF to Excel:** Table grid extraction directly into XLSX.
- **PDF to Markdown & Text:** Clean structure extraction for note-taking.

### Interactive Editor & Annotator
- Client-side Canvas-based PDF viewer with zoom controls and page navigation.
- Add text boxes, custom text notes, colors, and font sizes.
- Draw freehand diagrams and annotations directly on document sheets.
- Save modified document back to private vault or download immediately.

### Security & Redaction
- **AES-256 Encryption:** Standard PDF password protection.
- **Unlock PDF:** Decrypt password-protected files when a valid password is supplied.
- **Diagonal Watermarks:** Adjustable opacity, angle, font size, and color.
- **Permanent Redaction:** Deep redaction that strips underlying text and vector streams so data cannot be recovered.

### Grounded AI Workspace
- **Grounded Summarizer:** Structured, executive, and key point summaries citing page numbers.
- **Chat with PDF:** Grounded Q&A against document text with verified page citations.
- **Extraction:** Action items, dates, and named entities.
- **Study Assistant:** Practice flashcards and quiz questions.
- **Truthful Fallback:** If `GEMINI_API_KEY` is not provided, the platform reports configuration status honestly and displays extractive analysis without fake simulated responses.

### Private Cloud Vault & Workflows
- Isolated user document directories with SHA-256 hash deduplication.
- Expiring secure share links with 48-hour time bounds.
- Multi-step custom workflows: combine operations (e.g. merge → compress → watermark → encrypt) into reusable pipelines.

---

## 5. Mobile & Google Play Store Readiness

The frontend is styled mobile-first with responsive touch targets and clean navigation. A complete Capacitor configuration (`mobile/capacitor.config.ts`) and Google Play Store submission roadmap (`mobile/README.md`) are provided.

To open in Android Studio:
```bash
cd mobile
npx cap add android
npx cap open android
```
Review `mobile/README.md` for keystore generation, `bundleRelease` commands, and Google Play Data Safety questionnaire answers.

---

## 6. Security & Privacy Commitments

1. **Private Vault Isolation:** Documents are strictly bound to authenticated user ownership. Access without valid ownership returns `404` or `401`.
2. **Path Traversal Defense:** Storage operations resolve relative keys against an absolute root and sanitize all filenames.
3. **Zero AI Model Training:** Uploaded documents are never used to train foundation models.
4. **Permanent Redaction:** Redacted boxes purge the underlying binary streams rather than merely drawing an overlay.
