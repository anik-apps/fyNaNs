# fyNaNs

Personal finance tracking app for web and mobile. Connect bank accounts, track transactions, manage budgets, and stay on top of bills.

The name plays on "finances" with an embedded **NaN** (Not a Number) — because personal finance is not just numbers.

## Features

- **Dashboard** — Net worth, account balances, spending summary at a glance
- **Transaction Tracking** — Auto-categorized via Plaid, manual import via CSV/OFX
- **Budgeting** — Per-category budgets with progress tracking
- **Bill Tracking** — Recurring bills, credit card bills auto-synced from connected accounts

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI, SQLAlchemy, Alembic |
| Database | PostgreSQL |
| Web | Next.js (React), TypeScript |
| Mobile | React Native (Expo) |
| Bank Data | Plaid + CSV/OFX manual import |
| Hosting | OCI (ARM VM) with Caddy reverse proxy |

## Project Structure

```
fyNaNs/
├── apps/
│   ├── api/                          # FastAPI backend
│   │   ├── src/
│   │   │   ├── main.py               # FastAPI app entry point, CORS, rate limit middleware
│   │   │   ├── core/
│   │   │   │   ├── config.py         # App settings from env vars (pydantic-settings)
│   │   │   │   ├── database.py       # Async SQLAlchemy engine + session factory
│   │   │   │   ├── rate_limit.py     # In-memory per-IP rate limiter with proxy-aware IP detection
│   │   │   │   └── security.py       # Password hashing (bcrypt), JWT encode/decode, AES-256-GCM encryption
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
│   │   │   │   └── deps.py           # FastAPI dependencies (get_current_user, get_db)
│   │   │   └── jobs/
│   │   │       ├── scheduler.py      # APScheduler setup with PostgreSQL job store
│   │   │       ├── bill_reminders.py # Daily job: check bills due soon, send notifications
│   │   │       ├── budget_alerts.py  # 6-hourly job: check 80%/100% spend thresholds
│   │   │       └── fallback_sync.py  # 3-day job: sync stale Plaid items (quota-aware)
│   │   ├── migrations/               # Alembic async migrations
│   │   ├── tests/                    # 156 pytest tests + 43 integration tests
│   │   │   └── factories.py         # Test data factories for dashboard-related models
│   ├── web/                          # Next.js frontend — coming in Plan 5
│   └── mobile/                       # React Native (Expo) — coming in Plan 6
├── packages/
│   ├── api-client/                   # Auto-generated TypeScript API client (openapi-ts + @hey-api/client-fetch)
│   │   ├── openapi-ts.config.ts      # Code generation config (input: openapi.json, output: src/)
│   │   └── tsconfig.json             # TypeScript build config
│   └── shared-types/                 # Shared TypeScript types and constants
│       └── src/
│           ├── index.ts              # Barrel re-exports
│           ├── accounts.ts           # Account type constants and labels
│           ├── budgets.ts            # Budget period constants and thresholds
│           ├── bills.ts              # Bill frequency constants and status helpers
│           └── constants.ts          # App-wide constants (notifications, theme, pagination)
├── scripts/
│   ├── seed-categories.py            # Seeds 40+ default transaction categories
│   ├── generate-api-client.sh        # Downloads OpenAPI spec and generates TypeScript client
│   ├── deploy.sh                     # Production deployment (build, migrate, restart)
│   ├── backup-db.sh                  # pg_dump to OCI Object Storage
│   ├── restore-db.sh                 # Restore from OCI Object Storage backup
│   └── setup-server.sh               # One-time OCI ARM VM setup
├── Caddyfile                          # Reverse proxy config (auto HTTPS)
├── docker-compose.yml                 # Local dev PostgreSQL
└── docker-compose.prod.yml            # Production services (Caddy, API, web, DB)
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

## Production Deployment

The app deploys to an OCI (Oracle Cloud Infrastructure) Always Free ARM VM with Docker Compose.

### Architecture

```
Internet → [Caddy :443] → /api/* → [FastAPI :8000] → [PostgreSQL :5432]
                        → /*     → [Next.js :3000]
```

- **Caddy** handles TLS termination (auto Let's Encrypt) and routing
- **FastAPI** serves the REST API under `/api/*`
- **Next.js** serves the web frontend
- **PostgreSQL** runs in Docker with a persistent volume
- All services on a single ARM VM (4 OCPU, 24 GB RAM)

### Quick Deploy

```bash
# On the OCI VM:
./scripts/setup-server.sh   # One-time server setup
cp .env.production.example .env.production
# Fill in .env.production values
./scripts/deploy.sh          # Build, migrate, start
```

### Backups

Daily automated backups via `pg_dump` to OCI Object Storage with 7 daily + 4 weekly retention. See `scripts/backup-db.sh`.

For full deployment instructions, see [docs/oci-setup.md](docs/oci-setup.md).

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

### How Deployment Works

```
Push to main → CI builds ARM64 Docker images → Pushes to GHCR →
SSHs into VM → Generates .env from secrets → Pulls images →
SCPs config files → docker compose up → Health check
```

Nothing persists on the VM except Docker volumes (database data). All config and secrets are delivered fresh on each deploy.

## License

TBD
