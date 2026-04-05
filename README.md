# fyNaNs

Personal finance tracking app for web and mobile. Connect bank accounts, track transactions, manage budgets, and stay on top of bills.

The name plays on "finances" with an embedded **NaN** (Not a Number) — because personal finance is not just numbers.

## Features

- **Dashboard** — Net worth, account balances, spending summary at a glance
- **Bank Linking** — Connect accounts via Plaid Link (native SDK on mobile, web modal on desktop)
- **Transaction Tracking** — Auto-categorized via Plaid, manual import via CSV/OFX
- **Budgeting** — Per-category budgets with progress tracking
- **Bill Tracking** — Recurring bills, credit card bills auto-synced from connected accounts
- **Observability** — Prometheus metrics, structured JSON logging, Grafana Cloud dashboards

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI, SQLAlchemy, Alembic |
| Database | PostgreSQL |
| Web | Next.js 15 (React 19), TypeScript |
| Mobile | React Native (Expo SDK 54) |
| Bank Data | Plaid + CSV/OFX manual import |
| Observability | Prometheus, Grafana Cloud (Loki + Alloy) |
| Hosting | OCI ARM VM (free tier), Docker Compose, Caddy |
| CI/CD | GitHub Actions, self-hosted ARM runner, GHCR |

## Architecture

### Multi-Service Hosting (OCI VM)
```
Internet → Caddy (ports 80/443, auto-TLS via Let's Encrypt)
             ├── fynans.kumaranik.com/api/*  → FastAPI (internal:8000)
             ├── fynans.kumaranik.com/*       → Next.js (internal:3000)
             └── import /etc/caddy/sites/*.caddy  → other services
```
New services drop a `.caddy` file in `caddy-sites/` and restart Caddy. No changes to existing configs needed.

### Plaid Integration
- **Dual environment support** — sandbox + production Plaid clients, cached per-environment
- **Dev sandbox toggle** — allowlisted users (`DEV_ALLOWLIST_EMAILS`) can switch to Plaid sandbox via `POST /api/dev/sandbox-toggle`
- **Mobile:** `react-native-plaid-link-sdk` (native modal) | **Web:** Plaid Link CDN script
- **Sync flow:** exchange token → fetch accounts → sync transactions (cursor-based) → sync liabilities
- **Rate limiting:** 5-minute minimum between manual syncs, 3-day fallback auto-sync for stale items
- **PlaidItem.environment** column distinguishes sandbox vs production data

### Observability
- **Metrics:** `prometheus-client` → `/metrics` endpoint → Grafana Alloy scrapes → Grafana Cloud Prometheus
- **Logs:** `python-json-logger` → JSON stdout → Alloy tails Docker logs → Grafana Cloud Loki
- **Dashboards:** JSON files in `grafana/dashboards/`, auto-provisioned on deploy via Grafana Cloud API
- **Security:** `/metrics` blocked externally via Caddy (403), only reachable on internal Docker network

## Project Structure

```
fyNaNs/
├── apps/
│   ├── api/                          # FastAPI backend
│   │   ├── src/
│   │   │   ├── main.py               # FastAPI app entry point, CORS, rate limit middleware
│   │   │   ├── core/
│   │   │   │   ├── config.py         # App settings from env vars (pydantic-settings)
│   │   │   │   ├── constants.py      # Shared constants (income/transfer category sets)
│   │   │   │   ├── database.py       # Async SQLAlchemy engine + session factory + query timing events
│   │   │   │   ├── metrics.py        # Prometheus metric definitions (operational + business)
│   │   │   │   ├── logging_config.py # Structured JSON logging setup (python-json-logger)
│   │   │   │   ├── rate_limit.py     # In-memory per-IP rate limiter with proxy-aware IP detection
│   │   │   │   └── security.py       # Password hashing (bcrypt), JWT encode/decode, AES-256-GCM encryption
│   │   │   ├── middleware/
│   │   │   │   ├── metrics.py        # Pure ASGI request metrics middleware (latency, count, in-progress)
│   │   │   │   └── request_logging.py # Pure ASGI structured request logging
│   │   │   ├── models/
│   │   │   │   ├── base.py           # Base model with UUID pk + created_at/updated_at
│   │   │   │   ├── user.py           # User model (email, password_hash, mfa_secret)
│   │   │   │   ├── oauth_account.py  # OAuth provider links (Google, Apple)
│   │   │   │   ├── user_settings.py  # Theme, notification preferences
│   │   │   │   ├── refresh_token.py  # JWT refresh tokens with rotation tracking (sessions)
│   │   │   │   ├── category.py       # Hierarchical transaction categories (system + custom)
│   │   │   │   ├── plaid_item.py     # Plaid bank link with encrypted access token + sync cursor
│   │   │   │   ├── account.py        # Bank accounts (Plaid-linked + manual)
│   │   │   │   └── transaction.py    # Financial transactions with Plaid dedup + query indexes
│   │   │   ├── schemas/
│   │   │   │   ├── auth.py           # Auth request/response models (register, login, MFA, tokens)
│   │   │   │   ├── user.py           # Profile and settings request/response models
│   │   │   │   ├── common.py         # Shared schemas (error responses)
│   │   │   │   ├── plaid.py          # Plaid link/exchange request/response models
│   │   │   │   ├── account.py        # Account CRUD request/response models
│   │   │   │   ├── transaction.py    # Transaction CRUD, import, summary models
│   │   │   │   ├── category.py       # Category CRUD request/response models
│   │   │   │   └── dashboard.py      # Dashboard aggregation response schemas
│   │   │   ├── services/
│   │   │   │   ├── auth.py           # Registration, login, password validation
│   │   │   │   ├── token.py          # JWT creation, refresh token rotation with grace window
│   │   │   │   ├── oauth.py          # Google OAuth token verification
│   │   │   │   ├── mfa.py           # TOTP secret generation and verification
│   │   │   │   ├── email.py          # Password reset + export emails via Resend
│   │   │   │   ├── plaid.py          # Plaid API: link, sync, liabilities, webhooks, quota strategy
│   │   │   │   ├── account.py        # Account CRUD with Plaid-to-manual conversion + bill nullification
│   │   │   │   ├── transaction.py    # Transaction CRUD, CSV/OFX import with deduplication
│   │   │   │   ├── category.py       # Category CRUD with system category protection
│   │   │   │   ├── budget.py         # Budget CRUD with computed spend per period
│   │   │   │   ├── bill.py           # Bill CRUD with auto-advance to next future due date
│   │   │   │   ├── notification.py   # Notification dedup, push via Expo Push API
│   │   │   │   ├── export.py         # User data export as ZIP of JSON files
│   │   │   │   └── dashboard.py      # Dashboard aggregation (net worth, budgets, bills, spending)
│   │   │   ├── routers/
│   │   │   │   ├── auth.py           # /api/auth/* (register, login, OAuth, MFA, sessions)
│   │   │   │   ├── user.py           # /api/user/* (profile, settings, export, account deletion)
│   │   │   │   ├── health.py         # GET /api/health (DB connectivity check)
│   │   │   │   ├── plaid.py          # /api/plaid/* (link, exchange, webhook, items)
│   │   │   │   ├── accounts.py       # /api/accounts/* (CRUD, balance)
│   │   │   │   ├── transactions.py   # /api/transactions/* (CRUD, import, summary)
│   │   │   │   ├── categories.py     # /api/categories/* (CRUD)
│   │   │   │   ├── budgets.py        # /api/budgets/* (CRUD, overview with % spent)
│   │   │   │   ├── bills.py          # /api/bills/* (CRUD, upcoming)
│   │   │   │   ├── notifications.py  # /api/notifications/* (list, mark read)
│   │   │   │   ├── device_tokens.py  # /api/device-tokens/* (register, unregister)
│   │   │   │   ├── dashboard.py      # GET /api/dashboard (aggregated dashboard view)
│   │   │   │   ├── dev.py            # /api/dev/* (sandbox toggle, dev-only endpoints)
│   │   │   │   ├── metrics.py        # GET /metrics (Prometheus exposition)
│   │   │   │   └── deps.py           # FastAPI dependencies (get_current_user, get_db)
│   │   │   └── jobs/
│   │   │       ├── scheduler.py      # APScheduler setup with PostgreSQL job store
│   │   │       ├── bill_reminders.py # Daily job: check bills due soon, send notifications
│   │   │       ├── budget_alerts.py  # 6-hourly job: check 80%/100% spend thresholds
│   │   │       └── fallback_sync.py  # 3-day job: sync stale Plaid items (quota-aware)
│   │   ├── migrations/               # Alembic async migrations
│   │   ├── tests/                    # Unit + integration tests
│   │   │   ├── integration/         # Integration tests against live API (httpx)
│   │   │   └── factories.py         # Test data factories for dashboard-related models
│   ├── web/                          # Next.js 15 frontend
│   └── mobile/                       # React Native (Expo) mobile app
│       ├── app/                      # Expo Router file-based navigation
│       │   ├── (auth)/               # Auth stack (login, register, MFA, forgot-password)
│       │   ├── (tabs)/               # Bottom tab navigator
│       │   │   ├── index.tsx          # Dashboard screen
│       │   │   ├── accounts/          # Account list, detail, add (manual + Plaid Link)
│       │   │   ├── transactions/      # Transactions with search, filters, detail view
│       │   │   ├── budgets.tsx        # Budget cards with progress bars
│       │   │   ├── bills.tsx          # Bills with status indicators
│       │   │   └── settings/          # Profile, security, notifications
│       │   └── settings/
│       │       └── dev.tsx            # Dev settings (Plaid sandbox toggle, allowlisted users only)
│       └── src/
│           ├── components/            # Reusable UI components per feature
│           ├── hooks/                 # useAuth, useApi, useBiometric, usePushNotifications
│           ├── lib/                   # API client, auth storage, Plaid Link helper, bill-constants, utils
│           └── providers/             # AuthProvider, ThemeProvider
├── packages/
│   ├── api-client/                   # Auto-generated TypeScript API client (openapi-ts + @hey-api/client-fetch)
│   │   ├── openapi-ts.config.ts      # Code generation config (input: openapi.json, output: src/)
│   │   └── tsconfig.json             # TypeScript build config
│   └── shared-types/                 # Shared TypeScript types and constants
│       └── src/
│           ├── index.ts              # Barrel re-exports
│           ├── accounts.ts           # Account type constants and labels
│           ├── budgets.ts            # Budget period constants and thresholds
│           └── bills.ts              # Bill frequency constants and status helpers
├── grafana/
│   └── dashboards/                   # Grafana dashboard JSON files (auto-provisioned on deploy)
│       ├── api-overview.json         # Request rate, error rate, latency percentiles
│       ├── infrastructure.json       # DB pool, query duration, container resources
│       └── business.json             # Signups, Plaid usage, transaction volume
├── caddy-sites/                      # Shared Caddy config for multi-service hosting
├── alloy-config.alloy                # Grafana Alloy scrape/push configuration
├── scripts/
│   ├── seed-categories.py            # Seeds 40+ default transaction categories
│   └── generate-api-client.sh        # Downloads OpenAPI spec and generates TypeScript client
├── docker-compose.yml                # Local dev PostgreSQL
└── docker-compose.prod.yml           # Production: all services + Caddy + Alloy
```

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 20+
- pnpm
- Poetry
- Docker (for PostgreSQL)

### Setup

```bash
# Start PostgreSQL
docker compose up -d

# Install Python dependencies
cd apps/api && poetry install

# Create .env from example
cp ../../.env.example .env
# Edit .env with your secrets (JWT_SECRET_KEY, ENCRYPTION_MASTER_SECRET)

# Run migrations
poetry run alembic upgrade head

# Seed default categories
poetry run python ../../scripts/seed-categories.py

# Start the API server
poetry run uvicorn src.main:app --reload

# Run tests
poetry run pytest -v
```

The API docs are available at `http://localhost:8000/docs` when running.

### Mobile App

```bash
# Install dependencies (from repo root)
pnpm install

# Start Expo dev server
cd apps/mobile
pnpm start
```

Scan the QR code with Expo Go on your device to run the app. The API URL defaults to `http://localhost:8888` and can be configured via the `EXPO_PUBLIC_API_URL` environment variable.

### GitHub Secrets Required

All secrets are managed in GitHub → Settings → Secrets and variables → Actions.

| Secret | Description | How to generate |
|--------|-------------|-----------------|
| `OCI_HOST` | VM public IP address | From OCI console |
| `OCI_USER` | SSH username | `ubuntu` for Ubuntu VMs |
| `OCI_SSH_KEY` | Dedicated deploy SSH private key | `ssh-keygen -t ed25519 -C "deploy@fynans"` |
| `DB_PASSWORD` | PostgreSQL password | `openssl rand -hex 32` |
| `JWT_SECRET_KEY` | JWT signing secret | `openssl rand -hex 32` |
| `ENCRYPTION_MASTER_SECRET` | AES encryption key for Plaid tokens | `openssl rand -hex 32` |
| `DOMAIN` | Production domain | e.g., `fynans.kumaranik.com` |
| `PLAID_CLIENT_ID` | Plaid API client ID | From [Plaid dashboard](https://dashboard.plaid.com) |
| `PLAID_SECRET` | Plaid API secret | From Plaid dashboard |
| `PLAID_ENV` | Plaid environment | `sandbox`, `development`, or `production` |
| `RESEND_API_KEY` | Email service API key | From [Resend](https://resend.com) (optional) |
| `GRAFANA_CLOUD_PROMETHEUS_URL` | Prometheus remote-write URL | From Grafana Cloud stack details |
| `GRAFANA_CLOUD_LOKI_URL` | Loki push URL | From Grafana Cloud stack details |
| `GRAFANA_CLOUD_PROM_USER` | Prometheus instance ID (numeric) | From Grafana Cloud Prometheus details |
| `GRAFANA_CLOUD_LOKI_USER` | Loki instance ID (numeric) | From Grafana Cloud Loki details |
| `GRAFANA_CLOUD_API_KEY` | Cloud API key (glc_ token) | From Grafana Cloud → API keys |
| `GRAFANA_CLOUD_URL` | Grafana instance URL | e.g., `https://anikapps.grafana.net` |
| `GRAFANA_DASHBOARD_TOKEN` | Grafana instance token (glsa_, Editor role) | From Grafana → Service accounts |

### How Deployment Works

```
Push to main
  → CI: lint, frontend tests (Jest/Vitest), unit tests, integration tests (mandatory)
  → Deploy: build ARM64 images on self-hosted runner → push to GHCR
  → Copy configs (docker-compose, Caddyfile, alloy-config)
  → Generate .env.production from GitHub secrets
  → docker compose up → alembic migrate → health check
  → Provision Grafana dashboards via API
```

Nothing persists on the VM except Docker volumes (database data, Caddy certs, Alloy WAL). All config and secrets are delivered fresh on each deploy.

**Staging deploy:** Triggered manually via `workflow_dispatch`. Builds from any branch/PR and deploys to the same VM (replaces production temporarily).

## License

TBD
