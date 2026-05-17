# Deploy — GitHub Actions → Vercel

CI/CD: push to `main` → `.github/workflows/deploy.yml` builds & deploys two
Vercel projects (frontend + backend) via the Vercel CLI.

## One-time setup

### 1. Vercel projects (do once, in Vercel dashboard or CLI)

Create **two** projects from this repo:

| Project | Root directory | Framework |
|---|---|---|
| `xccelera-frontend` | `frontend` | Vite |
| `xccelera-backend`  | `backend`  | Other (Python, uses `vercel.json`) |

Easiest: `npm i -g vercel`, then in each dir run `vercel link` once
(creates `.vercel/project.json` with the IDs — do NOT commit it).

### 2. Vercel env vars (Project → Settings → Environment Variables, Production)

**Backend project:**
```
GEMINI_API_KEY        = <real>
GEMINI_MODEL          = gemini-2.5-flash
SUPABASE_URL          = https://jwkaeamalpewamuqiiai.supabase.co
SUPABASE_SERVICE_KEY  = <real sb_secret_...>
SUPABASE_DB_URL       = postgresql://postgres.jwkaeamalpewamuqiiai:<pw>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
HISTORY_LIMIT         = 20
CORS_ORIGINS          = https://<frontend-domain>.vercel.app
```

**Frontend project:**
```
VITE_API_BASE_URL     = https://<backend-domain>.vercel.app
VITE_SUPABASE_URL     = https://jwkaeamalpewamuqiiai.supabase.co
VITE_SUPABASE_ANON_KEY= sb_publishable_...
```
(`VITE_*` baked at build → must be set before deploy. After first deploy you
know both domains; set them, then re-run the workflow.)

### 3. GitHub repo secrets (Settings → Secrets and variables → Actions)

```
VERCEL_TOKEN                = <vercel.com/account/tokens>
VERCEL_ORG_ID               = <from .vercel/project.json "orgId">
VERCEL_PROJECT_ID_FRONTEND  = <frontend .vercel/project.json "projectId">
VERCEL_PROJECT_ID_BACKEND   = <backend  .vercel/project.json "projectId">
```

## Flow

1. Push to `main`.
2. Actions runs `frontend` + `backend` jobs in parallel:
   `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod`.
3. Both go live on their `*.vercel.app` domains.

## Gotchas

- `SUPABASE_DB_URL` must stay the **Session pooler** (`...pooler.supabase.com:5432`).
  Direct host is IPv6-only; transaction pooler `:6543` breaks LangGraph.
- Update `CORS_ORIGINS` to the real frontend domain or browser calls 403.
- Backend on Vercel is serverless: graph + DB pool init lazily per cold start
  (`runtime.py`); first request after idle is slower.
- Supabase email confirmation OFF for demo (built-in SMTP rate-limited).
