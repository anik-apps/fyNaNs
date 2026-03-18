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
│   ├── api/          # FastAPI backend
│   ├── web/          # Next.js frontend
│   └── mobile/       # React Native (Expo)
├── packages/
│   ├── api-client/   # Auto-generated TypeScript API client
│   └── shared-types/ # Shared TypeScript types/constants
├── scripts/          # Build and seed scripts
└── docker-compose.yml
```

## Getting Started

> Coming soon — project is in initial development.

## License

TBD
