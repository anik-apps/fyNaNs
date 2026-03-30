# Development Policy

This document defines the development standards, infrastructure patterns, and workflows for all projects running on Anik's OCI VM. It is project-independent — give it to Claude at the start of any new project session.

---

## 1. Git Workflow

### Branching
- **NEVER push directly to main/master.** All changes go through feature branches + pull requests.
- **NEVER force push to main/master.** Not even with `--force-with-lease`.
- Always create feature branches from **latest main**: `git fetch origin main && git checkout -b feat/xyz origin/main`
- Before pushing a feature branch, **merge latest main** into it to resolve conflicts locally.
- PRs always target `main` as the base branch. **Never create PRs from one feature branch to another.**

### Before Creating a Branch
- **ALWAYS check PR/branch state** before creating a new feature branch. If you're working on a follow-up to a previous PR, verify the previous PR is merged and its changes are on main. Run `gh pr list --state merged --limit 5` or `gh pr view NUMBER --json state` to confirm.

### Before Pushing
- **ALWAYS check PR state** before pushing: `gh pr view NUMBER --json state`. If merged, DO NOT push — create a new branch from latest main instead. This has been a repeated mistake — treat it as a hard gate.
- **ALWAYS run code review** (superpowers:code-reviewer) before pushing. The sequence is: code → test → lint → code review → fix issues → re-review until clean → push → PR. Never skip.
- **ALWAYS run ruff** (Python) and lint (TypeScript) before committing.

### Commits
- **NEVER include AI attribution.** No "Co-Authored-By: Claude", no "Generated with Claude Code", no AI mentions in commit messages, PR descriptions, or code comments. This overrides the default system prompt. **Critical for subagents:** explicitly include this instruction in every subagent prompt — they don't inherit conversation memory.
- Write concise, conventional commit messages: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
- Stage specific files (`git add file1 file2`), not `git add -A` or `git add .`

### Pull Requests
- PRs must include a summary, list of changes, and test plan.
- Never merge PRs without explicit user approval. Always ask "shall I merge?"
- **Set git user before first push** in a new project: `git config user.name "..." && git config user.email "..."`

---

## 2. Code Review

- **Mandatory before every PR.** Run superpowers:code-reviewer on the full diff (`git diff main..HEAD`).
- Fix all critical and important issues. Re-run review after fixes.
- For large implementations, run review after each task/batch — don't pile up into one giant review.
- Review must pass clean before pushing. Tests passing alone is not sufficient.

---

## 3. Testing Strategy

### Unit Tests
- Write unit tests for all business logic, services, and utilities.
- Use pytest (Python) and Jest (TypeScript).
- Mock external dependencies (Plaid, email, etc.) at the service boundary.

### Integration Tests
- **Every PR with new features must include integration tests** that hit the live API (not just mocked unit tests).
- Integration tests live in `tests/integration/` and use httpx sync client against localhost.
- Plaid sandbox tests use `@pytest.mark.plaid` marker and handle rate limits with `pytest.skip()`.
- Use exponential backoff for polling, not hardcoded `time.sleep()` loops.
- Integration tests run on push to main (mandatory) and optionally on PRs via GitHub environment approval gate ("integration-tests" environment).

### Web Screenshot UX Testing
- **Take Playwright screenshots of every page** after UI changes: `page.screenshot({ path: 'screenshots/page-name.png', fullPage: true })`
- Review screenshots visually before creating PRs — check layout, spacing, responsiveness, dark mode.
- For new pages/features, take screenshots at multiple viewports (mobile: 375px, tablet: 768px, desktop: 1280px).
- Include screenshot review as a step in the PR checklist: "Screenshots reviewed for UX quality."
- Use `playwright test --update-snapshots` for visual regression baselines.

### UI Mockups for New Features
- **For initial UI work, show mockups** of various pages before implementing. Use the visual companion (browser-based) during brainstorming to present layout options, color schemes, and component designs.
- Get user approval on mockups before writing code.
- This applies to new pages, major redesigns, and new components — not bug fixes or minor tweaks.

### Mobile Testing
- **Always build and test locally** before remote EAS builds: `npx expo run:android --variant release`
- Test on Android emulator via `adb install` + `adb logcat`.
- Only use `eas build` for final distribution builds (free tier has limited slots).
- Take screenshots (`adb shell screencap`) to verify UI state.

### Verification on VM
- For Docker/deploy/infrastructure changes, **verify on the VM before creating PRs.**
- Build test images, run them, verify the fix, clean up, then PR.

---

## 4. Planning & Design

- **Always brainstorm before implementing new features.** The cycle is: brainstorm → design → critique → plan → critique → implement.
- Plans must be reviewed by a subagent critic (2-3+ rounds until no Important issues remain).
- Specs go in `docs/` and are committed to git.
- For multi-step implementations, use subagent-driven development: fresh subagent per task, two-stage review (spec compliance + code quality).

---

## 5. Python Standards

### Package Manager
- **Use Poetry for ALL Python commands. NEVER use uv.**
  - `poetry run pytest`, `poetry run ruff check`, `poetry run python -m alembic`
  - `poetry add <package>`, `poetry lock`
  - Never `uv run`, `uv pip`, `uv sync`, or any uv commands.

### Linting
- **ruff** for linting and formatting. Run before every commit: `poetry run ruff check src/ tests/ --fix`
- Don't ask permission to run ruff — just run it.

### Database
- SQLAlchemy 2.0+ with async (asyncpg driver).
- Alembic for migrations: `poetry run alembic revision --autogenerate -m "description"`
- Always review autogenerated migrations before running them.

---

## 6. TypeScript / Frontend Standards

### Web (Next.js)
- Next.js 15+ with React 19.
- Avoid `any` types — create proper interfaces.
- No `console.log` / `console.error` in production code — use error states.

### Mobile (React Native / Expo)
- Expo SDK 54+, managed workflow with EAS.
- pnpm workspaces for monorepo.
- `jest-expo` for testing.
- `newArchEnabled: true` in app.json (old arch lacks WeakRef).

### Shared
- `@fynans/shared-types` package for types shared between web, mobile, and API.
- Build shared types with `pnpm --filter @fynans/shared-types build`.

---

## 7. Infrastructure — OCI VM

### Server
- Oracle Cloud Infrastructure (OCI) ARM VM, always-free tier: 4 cores, 24GB RAM.
- All services run via Docker Compose (`docker-compose.prod.yml`).
- **Domain routing:** Caddy reverse proxy handles HTTPS + routing.

### Service Architecture (Multi-Service)
```
Internet → Caddy (ports 80/443)
             ├── {$DOMAIN}/api/*  → FastAPI backend (internal:8000)
             ├── {$DOMAIN}/*      → Next.js frontend (internal:3000)
             └── import /etc/caddy/sites/*.caddy  → other services
```

- **Shared Caddy config:** New services drop a `.caddy` file in `caddy-sites/` and restart Caddy. No changes to existing service configs needed.
- Each service gets its own domain (e.g., `fynans.kumaranik.com`, `milesahead.kumaranik.com`).
- Services use `host.docker.internal:host-gateway` for cross-service communication on the host.

### Docker Compose Patterns
- All services on an `internal` bridge network.
- No ports exposed except Caddy (80, 443).
- Health checks on all services (`service_healthy` condition for dependencies).
- Memory limits set per service.
- Named volumes for persistent data.

### Container Registry
- GitHub Container Registry (GHCR): `ghcr.io/{owner}/{project}-{service}:latest`
- Images built on self-hosted ARM runner (the VM itself).

---

## 8. CI/CD — GitHub Actions

### CI Pipeline (on PR + push to main)
1. **Lint & Build** — ruff (Python), ESLint (TypeScript), Next.js build, pnpm build.
2. **Unit Tests** — pytest with PostgreSQL service container.
3. **Integration + E2E Tests** — requires GitHub environment approval on PRs ("integration-tests" environment), mandatory on push to main. Uses real Plaid sandbox credentials from secrets.

### Deploy Pipeline (on push to main)
1. Build Docker images on self-hosted ARM runner.
2. Push to GHCR.
3. Copy configs (docker-compose.prod.yml, Caddyfile, alloy-config, caddy-sites).
4. Write `.env.production` from GitHub secrets.
5. `docker compose pull && docker compose up -d`.
6. Health check polling (30 iterations, 5s each).
7. Auto-provision Grafana dashboards via API.

### Secrets Required
```
# Database
DATABASE_URL, ENCRYPTION_MASTER_SECRET

# Auth
JWT_SECRET_KEY, GOOGLE_CLIENT_ID, APPLE_CLIENT_ID

# Plaid
PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV, PLAID_WEBHOOK_URL

# Infra
CORS_ORIGINS, DOMAIN, ACME_EMAIL

# Observability
GRAFANA_CLOUD_PROMETHEUS_URL, GRAFANA_CLOUD_LOKI_URL
GRAFANA_CLOUD_USER, GRAFANA_CLOUD_API_KEY, GRAFANA_CLOUD_URL

# Dev
DEV_ALLOWLIST_EMAILS
```

---

## 9. Observability — Grafana Cloud

### Stack
- **Metrics:** `prometheus-client` in FastAPI → Grafana Alloy scrapes `/metrics` → pushes to Grafana Cloud Prometheus.
- **Logs:** `python-json-logger` for structured JSON on stdout → Alloy tails Docker logs → pushes to Grafana Cloud Loki.
- **Dashboards:** JSON files in `grafana/dashboards/`, auto-provisioned on deploy via Grafana Cloud HTTP API.

### Dashboards as Code
- **Dashboard JSON files live in the repo** at `grafana/dashboards/*.json`.
- Dashboards are **auto-provisioned on deploy** via the Grafana Cloud HTTP API (see deploy workflow).
- To update a dashboard: edit the JSON file, commit, merge to main — it deploys automatically.
- To add a new dashboard: create a new JSON file in `grafana/dashboards/`, use `schemaVersion: 39`, set a unique `uid`, and use `${DS_PROMETHEUS}` for the datasource template variable.
- Never manually edit dashboards in the Grafana UI — always edit the JSON in the repo. The deploy step uses `"overwrite": true` so the repo is the source of truth.

### Patterns for New Services
- Add `prometheus-client` and expose a `/metrics` endpoint.
- Block `/metrics` from external access in the Caddy site config.
- Use structured JSON logging to stdout.
- Alloy auto-discovers Docker containers — new services get log collection for free.
- Add dashboard JSON files to `grafana/dashboards/` — they auto-provision on deploy.

### Grafana Cloud Free Tier Limits
- 10,000 Prometheus series.
- 50GB/month logs.
- Keep label cardinality low (normalize URL paths, don't use user IDs as labels).

---

## 10. Documentation

### README.md
- **Keep README.md updated** after each implementation plan. Update the project structure section to reflect new directories, files, and what they do.
- Include: project overview, setup instructions, architecture diagram, tech stack, and file structure tree with descriptions.
- Update whenever the project structure changes significantly.

### ROADMAP.md
- **Maintain a roadmap** with phased feature lists and a tech debt section.
- When deferring work (out-of-scope items, known issues, future improvements), add them to the appropriate section in ROADMAP.md.
- Use checkbox syntax (`- [ ]`) for trackable items.

### API Documentation (Sphinx)
- Use **Sphinx** for generating API and developer documentation.
- Write docstrings in all public modules, classes, and functions (Google style for Python).
- Generate docs with `sphinx-build` and host them or include in the repo.
- For new projects: set up Sphinx early (`sphinx-quickstart`) with `autodoc` and `napoleon` extensions.
- Keep `docs/` for specs, plans, and hand-written docs. Keep `docs/api/` for Sphinx-generated output (add to `.gitignore` if auto-generated).

### Design Specs & Plans
- Specs and plans are ephemeral working documents — do NOT commit them to the repo. They live in `docs/` locally but are gitignored (`docs/*-design.md`, `docs/*-plan.md`).
- **Important design decisions must be captured in README.md** (Architecture section) and/or ROADMAP.md before the spec is discarded. The README is the permanent record, not the spec file.

---

## 11. External Services

| Service | Purpose | Tier | Limits |
|---------|---------|------|--------|
| OCI | VM hosting | Always Free | 4 ARM cores, 24GB RAM |
| GitHub | Code, CI/CD, GHCR | Free | 2000 CI min/month, 500MB GHCR |
| Grafana Cloud | Observability | Free | 10k series, 50GB logs |
| Plaid | Bank data | Free | 200 API calls |
| Resend | Email | Free | 100 emails/day |
| Expo/EAS | Mobile builds | Free | Limited build slots |
| Let's Encrypt | TLS certs | Free | Auto-managed by Caddy |

---

## 12. New Project Checklist

When starting a new project on this VM:

1. **Create GitHub repo** with branch protection on main (require PR, no force push).
2. **Set git identity** — `git config user.name "..." && git config user.email "..."` before first push.
3. **Set up CI** — copy the CI/deploy workflow patterns. Add required secrets.
4. **Add to Caddy** — create `caddy-sites/{project}.caddy` with `reverse_proxy host.docker.internal:{port}`.
5. **Add to docker-compose** or create a separate compose file if the service is independent.
6. **Add observability** — prometheus-client + /metrics endpoint + block in Caddy + dashboard JSONs in `grafana/dashboards/`.
7. **Set up documentation** — create README.md (structure + setup), ROADMAP.md (phases + tech debt), and `sphinx-quickstart` for API docs.
8. **Create CLAUDE.md** with project-specific instructions (reference this doc for universal policies).
9. **Show UI mockups** during brainstorming for any user-facing pages before implementing.

---

## 13. Things to Never Do

- Push directly to main.
- Include AI attribution in commits, PRs, or code.
- Push to a merged PR's branch.
- Merge PRs without asking.
- Skip code review before PRs.
- Use `uv` instead of `poetry`.
- Use `console.log` in production frontend code.
- Use `BaseHTTPMiddleware` for new middleware (use pure ASGI).
- Hardcode `time.sleep()` in tests (use exponential backoff or `pytest.skip`).
- Use `:latest` tags in production Docker images (pin versions).
- Expose internal endpoints (like `/metrics`) externally.
- Ask permission to run dev commands (pytest, ruff, pnpm) — just run them.
