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
│   │   │   │   └── category.py       # Category CRUD request/response models
│   │   │   ├── services/
│   │   │   │   ├── auth.py           # Registration, login, password validation
│   │   │   │   ├── token.py          # JWT creation, refresh token rotation with grace window
│   │   │   │   ├── oauth.py          # Google OAuth token verification
│   │   │   │   ├── mfa.py           # TOTP secret generation and verification
│   │   │   │   ├── email.py          # Password reset emails via Resend
│   │   │   │   ├── plaid.py          # Plaid API: link, sync, liabilities, webhooks, quota strategy
│   │   │   │   ├── account.py        # Account CRUD with Plaid-to-manual conversion
│   │   │   │   ├── transaction.py    # Transaction CRUD, CSV/OFX import with deduplication
│   │   │   │   └── category.py       # Category CRUD with system category protection
│   │   │   ├── routers/
│   │   │   │   ├── auth.py           # /api/auth/* (register, login, OAuth, MFA, sessions)
│   │   │   │   ├── user.py           # /api/user/* (profile, settings)
│   │   │   │   ├── health.py         # GET /api/health (DB connectivity check)
│   │   │   │   ├── plaid.py          # /api/plaid/* (link, exchange, webhook, items)
│   │   │   │   ├── accounts.py       # /api/accounts/* (CRUD, balance)
│   │   │   │   ├── transactions.py   # /api/transactions/* (CRUD, import, summary)
│   │   │   │   ├── categories.py     # /api/categories/* (CRUD)
│   │   │   │   └── deps.py           # FastAPI dependencies (get_current_user, get_db)
│   │   │   └── jobs/                 # Background jobs (APScheduler) — coming in Plan 3
│   │   ├── migrations/               # Alembic async migrations
│   │   └── tests/                    # 73 pytest tests (auth, Plaid, accounts, transactions, categories)
│   ├── web/                          # Next.js frontend — coming in Plan 5
│   └── mobile/                       # React Native (Expo) — coming in Plan 6
├── packages/
│   ├── api-client/                   # Auto-generated TypeScript API client — coming in Plan 4
│   └── shared-types/                 # Shared TypeScript types/constants — coming in Plan 4
├── scripts/
│   └── seed-categories.py            # Seeds 40+ default transaction categories
└── docker-compose.yml                # Local dev PostgreSQL
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

## License

TBD
