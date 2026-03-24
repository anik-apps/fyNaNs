# fyNaNs Roadmap

## Phase 1 — MVP (Current)

- [ ] Project scaffolding (monorepo, tooling, CI)
- [ ] Auth (email/password, Google/Apple OAuth, 2FA)
- [ ] Plaid integration (bank linking, transaction sync, liabilities)
- [ ] Account management (linked + manual accounts)
- [ ] Transaction tracking (auto-categorized, manual entry, CSV/OFX import)
- [ ] Category system (hierarchical, system defaults + custom)
- [ ] Budgeting (per-category monthly budgets, progress tracking)
- [ ] Bill tracking (recurring bills, credit card auto-sync, reminders)
- [ ] Dashboard (net worth, balances, spending summary, budget status, upcoming bills)
- [ ] Notifications (budget alerts, bill reminders via email + push)
- [ ] Web app (Next.js, responsive)
- [ ] Mobile app (React Native / Expo)
- [ ] Deploy to OCI (Caddy + FastAPI + Postgres on ARM VM)

## Phase 2 — Extended Features

- [ ] Investment tracking (portfolio view, gains/losses)
- [ ] Credit score monitoring
- [ ] Shared accounts (household/partner finance tracking)

## Tech Debt & Code Quality

- [ ] OAuth account linking: require email verification before linking OAuth to existing account (security risk documented in routers/auth.py)
- [ ] OCI Object Storage export: implement actual file upload in services/export.py (currently just logs)
- [ ] Mobile TypeScript strictness: replace ~257 `any` types with proper interfaces across mobile app
- [ ] Consolidate web/mobile API client patterns (shared retry, error handling)
- [ ] Add error boundary `componentDidCatch` for production error logging (web)
- [ ] Plaid OAuth redirect handling for production (required for major US banks)

## Future Infrastructure

- [ ] Turborepo for JS build orchestration
- [ ] Redis for caching and rate limiting
- [ ] Separate background job worker
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Monitoring and observability (Sentry, structured logging)
- [ ] CDN for assets (Cloudflare)
- [ ] Database read replicas
- [ ] Feature flags for gradual rollout
- [ ] Vercel for frontend (edge CDN, preview deploys)
