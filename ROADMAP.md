# fyNaNs Roadmap

## Phase 1 — MVP (Complete)

- [x] Project scaffolding (monorepo with pnpm workspaces, Poetry for Python)
- [x] Auth (email/password, Google/Apple OAuth, 2FA/TOTP, session management)
- [x] Plaid integration (bank linking, transaction sync, liabilities, webhook-driven)
- [x] Account management (Plaid-linked + manual accounts, LINKED badge, sync status)
- [x] Transaction tracking (auto-categorized via Plaid, manual entry, CSV/OFX import)
- [x] Category system (hierarchical, 40+ system defaults + custom)
- [x] Budgeting (per-category monthly budgets, progress tracking, 80%/100% alerts)
- [x] Bill tracking (recurring bills, credit card auto-sync, due date reminders)
- [x] Dashboard (net worth chart, spending comparison, budget bars, upcoming bills)
- [x] Notifications (budget alerts, bill reminders via email + push)
- [x] Web app (Next.js 15, React 19, responsive)
- [x] Mobile app (React Native / Expo SDK 54, Plaid Link native SDK)
- [x] Deploy to OCI (Docker Compose, Caddy, self-hosted ARM runner, auto-deploy)
- [x] CI/CD (GitHub Actions: lint, unit tests, integration tests, E2E, staging deploy)
- [x] Observability (Prometheus metrics, structured JSON logging, Grafana Cloud dashboards)
- [x] Multi-service hosting (shared Caddy config, caddy-sites/ for additional services)

## Phase 1.5 — Polish & Hardening (Current)

- [ ] Plaid sandbox device testing (mobile emulator end-to-end)
- [ ] Deploy observability stack (Alloy container, Grafana Cloud secrets)
- [ ] Mobile app EAS production build and distribution
- [ ] Screenshot-based UX review across web pages
- [ ] Visual regression testing with Playwright snapshots
- [ ] Replace placeholder app icons with brand assets
- [ ] iOS build and testing

## Phase 2 — Extended Features

- [ ] Investment tracking (portfolio view, gains/losses)
- [ ] Credit score monitoring
- [ ] Shared accounts (household/partner finance tracking)
- [ ] Savings goals with progress tracking
- [ ] Spending insights and trends analysis (ML-powered categorization)
- [ ] Recurring transaction detection

## Tech Debt & Code Quality

### Completed

- [x] Fix N+1 queries in transaction_summary, list_plaid_items, get_budgets_with_spend
- [x] Extract hardcoded income/transfer category constants (API)
- [x] Consolidate ACCOUNT_TYPE_CONFIG across 3 web components
- [x] Extract date grouping and bill status constants (mobile)
- [x] Remove unused code: Pagination, serverFetch, useIsMobile/useIsDesktop, shared-types constants

### Remaining

- [ ] OAuth account linking: require email verification before linking to existing account
- [ ] OCI Object Storage export: implement actual file upload in services/export.py
- [ ] Mobile TypeScript strictness: replace ~257 `any` types with proper interfaces
- [ ] Consolidate web/mobile API client patterns (shared retry, error handling)
- [ ] Add error boundary `componentDidCatch` for production error logging (web)
- [ ] Plaid OAuth redirect handling for production (required for major US banks)
- [ ] Sphinx API documentation setup
- [ ] Upgrade GitHub Actions from Node.js 20 to Node.js 24
- [ ] Fix N+1 in dashboard _get_top_budgets (spend query per budget)
- [ ] Fix N+1 in spending_history (_compute_period_totals called per month)
- [ ] Add React.memo to list item components (web: transaction-row, bill-card, account-card, budget-progress)
- [ ] Add React.memo to chart components (mobile: CategoryDonutChart, NetWorthChart, SpendingBarChart)
- [ ] Create useChartSelection hook to consolidate 3 duplicate timeout patterns (mobile)
- [ ] Fix useApi hook dependency array gap (mobile)
- [ ] Add category_id ownership validation in create_transaction (API)
- [ ] Increase test coverage: mobile components (25+ untested), web components (45+ untested), API email service
- [ ] Consolidate Account interface — use shared-types instead of local definitions in web/mobile
- [ ] Remove or complete api-client package (currently empty placeholder)

## Future Infrastructure

- [ ] Turborepo for JS build orchestration
- [ ] Redis for caching and rate limiting (replace in-memory rate limiter)
- [ ] Separate background job worker (move APScheduler to dedicated process)
- [ ] Sentry for error tracking
- [ ] CDN for assets (Cloudflare)
- [ ] Database read replicas
- [ ] Feature flags for gradual rollout
- [ ] Vercel for frontend (edge CDN, preview deploys)
- [ ] Alerting rules in Grafana (error rate, latency p99, Plaid quota)
