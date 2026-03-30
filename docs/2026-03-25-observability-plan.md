# Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add metrics, structured JSON logging, and Grafana Cloud dashboards to fyNaNs.

**Architecture:** FastAPI exposes `/metrics` (Prometheus format). Grafana Alloy scrapes metrics and tails Docker logs, pushes both to Grafana Cloud. Three dashboards: API overview, infrastructure, business.

**Tech Stack:** prometheus-client, python-json-logger, Grafana Alloy, Grafana Cloud (free tier)

**Spec:** `docs/2026-03-25-observability-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `apps/api/src/core/metrics.py` | All Prometheus metric definitions (counters, histograms, gauges) |
| `apps/api/src/core/logging_config.py` | JSON logging formatter setup |
| `apps/api/src/middleware/__init__.py` | Package init (empty) |
| `apps/api/src/middleware/metrics.py` | Pure ASGI request metrics middleware |
| `apps/api/src/middleware/request_logging.py` | Pure ASGI request logging middleware |
| `apps/api/src/routers/metrics.py` | `/metrics` endpoint |
| `alloy-config.alloy` | Grafana Alloy scrape/push configuration |
| `grafana/dashboards/api-overview.json` | API request/latency/error dashboard |
| `grafana/dashboards/infrastructure.json` | Container + DB pool dashboard |
| `grafana/dashboards/business.json` | Signups, Plaid, transactions dashboard |

### Modified Files
| File | Change |
|------|--------|
| `apps/api/pyproject.toml` | Add prometheus-client, python-json-logger |
| `apps/api/src/main.py` | Register middlewares, logging, metrics route |
| `apps/api/src/core/database.py` | SQLAlchemy query timing events, pool stats |
| `apps/api/src/routers/auth.py` | Increment auth counters |
| `apps/api/src/services/plaid.py` | Increment Plaid counters |
| `apps/api/src/services/transaction.py` | Increment transaction counters |
| `apps/api/src/routers/budgets.py` | Increment budget counter |
| `apps/api/src/routers/bills.py` | Increment bill counter |
| `apps/api/src/services/account.py` | Increment manual account counter |
| `Caddyfile` | Block external `/metrics` access |
| `docker-compose.prod.yml` | Add Alloy service |
| `.env.example` | Add Grafana Cloud env vars |

---

## Task 1: Dependencies

**Files:**
- Modify: `apps/api/pyproject.toml`

- [ ] **Step 1: Add prometheus-client and python-json-logger**

```bash
cd apps/api && poetry add prometheus-client python-json-logger
```

- [ ] **Step 2: Verify install**

```bash
cd apps/api && poetry run python -c "import prometheus_client; from pythonjsonlogger import json as jsonlog; print('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/pyproject.toml apps/api/poetry.lock
git commit -m "chore: add prometheus-client and python-json-logger dependencies"
```

---

## Task 2: Metric Definitions

**Files:**
- Create: `apps/api/src/core/metrics.py`

- [ ] **Step 1: Create metrics module with all metric definitions**

Create `apps/api/src/core/metrics.py`:

```python
"""Prometheus metric definitions for fyNaNs API.

All metrics are defined here to avoid circular imports and ensure
a single source of truth for metric names and labels.
"""

from prometheus_client import Counter, Gauge, Histogram

# --- Operational Metrics ---

HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status_code"],
)

HTTP_REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

HTTP_REQUESTS_IN_PROGRESS = Gauge(
    "http_requests_in_progress",
    "Number of HTTP requests currently being processed",
)

DB_QUERY_DURATION = Histogram(
    "db_query_duration_seconds",
    "Database query duration in seconds",
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
)

DB_POOL_SIZE = Gauge("db_pool_size", "Database connection pool size")
DB_POOL_CHECKED_OUT = Gauge("db_pool_checked_out", "Database connections currently in use")

# --- Business Metrics ---

AUTH_SIGNUPS = Counter("auth_signups_total", "Total user registrations")
AUTH_LOGINS = Counter("auth_logins_total", "Total successful logins")
AUTH_LOGIN_FAILURES = Counter("auth_login_failures_total", "Total failed login attempts")

PLAID_ACCOUNTS_LINKED = Counter("plaid_accounts_linked_total", "Total Plaid accounts linked")
PLAID_SYNC = Counter("plaid_sync_total", "Plaid transaction syncs", ["status"])
PLAID_API_CALLS = Counter("plaid_api_calls_total", "Total Plaid API calls made")

TRANSACTIONS = Counter("transactions_total", "Total transactions created", ["source"])

BUDGETS_CREATED = Counter("budgets_created_total", "Total budgets created")
BILLS_CREATED = Counter("bills_created_total", "Total bills created")
```

- [ ] **Step 2: Verify import**

```bash
cd apps/api && poetry run python -c "from src.core.metrics import HTTP_REQUESTS_TOTAL; print('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/core/metrics.py
git commit -m "feat: add Prometheus metric definitions"
```

---

## Task 3: JSON Logging Configuration

**Files:**
- Create: `apps/api/src/core/logging_config.py`

- [ ] **Step 1: Create logging config module**

Create `apps/api/src/core/logging_config.py`:

```python
"""Structured JSON logging configuration.

Call setup_json_logging() once at app startup to configure all loggers
to output JSON to stdout.
"""

import logging
import sys

from pythonjsonlogger.json import JsonFormatter


def setup_json_logging(level: int = logging.INFO) -> None:
    formatter = JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        rename_fields={"asctime": "timestamp", "levelname": "level", "name": "logger"},
        datefmt="%Y-%m-%dT%H:%M:%S%z",
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)

    # Quiet noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("apscheduler").setLevel(logging.WARNING)
```

- [ ] **Step 2: Verify**

```bash
cd apps/api && poetry run python -c "
from src.core.logging_config import setup_json_logging
import logging
setup_json_logging()
logging.getLogger('test').info('hello')
"
```

Expected: JSON line with timestamp, level, logger, message.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/core/logging_config.py
git commit -m "feat: add JSON logging configuration"
```

---

## Task 4: Metrics Endpoint

**Files:**
- Create: `apps/api/src/routers/metrics.py`

- [ ] **Step 1: Create metrics router**

Create `apps/api/src/routers/metrics.py`:

```python
"""Prometheus metrics endpoint.

Serves metrics in Prometheus text exposition format.
Excluded from auth, rate limiting, and request logging.
"""

from fastapi import APIRouter, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

router = APIRouter(tags=["metrics"])


@router.get("/metrics")
async def metrics():
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )
```

Note: This router uses prefix="" (no /api prefix) since it's registered directly on the app, not on the api_router. Alloy scrapes `http://api:8000/metrics`.

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routers/metrics.py
git commit -m "feat: add /metrics Prometheus endpoint"
```

---

## Task 5: Request Metrics Middleware (Pure ASGI)

**Files:**
- Create: `apps/api/src/middleware/__init__.py`
- Create: `apps/api/src/middleware/metrics.py`

- [ ] **Step 1: Create middleware package**

```bash
mkdir -p apps/api/src/middleware
touch apps/api/src/middleware/__init__.py
```

- [ ] **Step 2: Create pure ASGI metrics middleware**

Create `apps/api/src/middleware/metrics.py`:

```python
"""Pure ASGI middleware for HTTP request metrics.

Tracks request count, duration, and in-progress gauge.
Uses request.scope["route"] for path normalization to avoid
high-cardinality labels from path parameters.
"""

import time

from starlette.routing import Match
from starlette.types import ASGIApp, Receive, Scope, Send

from src.core.metrics import (
    HTTP_REQUEST_DURATION,
    HTTP_REQUESTS_IN_PROGRESS,
    HTTP_REQUESTS_TOTAL,
)

SKIP_PATHS = {"/metrics", "/api/health"}


class MetricsMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if path in SKIP_PATHS:
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "GET")
        status_code = 500  # default if something goes wrong

        # Capture status code from response headers
        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
            await send(message)

        # Get normalized route path from FastAPI's router
        route_path = path
        if "app" in scope:
            app = scope["app"]
            for route in getattr(app, "routes", []):
                match, _ = route.matches(scope)
                if match == Match.FULL:
                    route_path = getattr(route, "path", path)
                    break

        HTTP_REQUESTS_IN_PROGRESS.inc()
        start = time.perf_counter()
        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration = time.perf_counter() - start
            HTTP_REQUESTS_IN_PROGRESS.dec()
            HTTP_REQUESTS_TOTAL.labels(
                method=method, endpoint=route_path, status_code=str(status_code)
            ).inc()
            HTTP_REQUEST_DURATION.labels(
                method=method, endpoint=route_path
            ).observe(duration)
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/middleware/
git commit -m "feat: add pure ASGI request metrics middleware"
```

---

## Task 6: Request Logging Middleware (Pure ASGI)

**Files:**
- Create: `apps/api/src/middleware/request_logging.py`

- [ ] **Step 1: Create request logging middleware**

Create `apps/api/src/middleware/request_logging.py`:

```python
"""Pure ASGI middleware for structured request logging.

Logs method, path, status_code, duration_ms, and client_ip
for every request. Skips /metrics and /api/health.
"""

import logging
import time

from starlette.types import ASGIApp, Receive, Scope, Send

logger = logging.getLogger("request")

SKIP_PATHS = {"/metrics", "/api/health"}


class RequestLoggingMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if path in SKIP_PATHS:
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "GET")
        client = scope.get("client")
        client_ip = client[0] if client else "unknown"
        status_code = 500

        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
            await send(message)

        start = time.perf_counter()
        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.info(
                "%s %s %d %.1fms",
                method,
                path,
                status_code,
                duration_ms,
                extra={
                    "method": method,
                    "path": path,
                    "status_code": status_code,
                    "duration_ms": round(duration_ms, 1),
                    "client_ip": client_ip,
                },
            )
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/middleware/request_logging.py
git commit -m "feat: add pure ASGI request logging middleware"
```

---

## Task 7: Database Metrics

**Files:**
- Modify: `apps/api/src/core/database.py`

- [ ] **Step 1: Add query timing events and pool stats**

Read `apps/api/src/core/database.py` first (currently 14 lines). Add SQLAlchemy event listeners after engine creation:

```python
import time

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.core.config import settings
from src.core.metrics import DB_POOL_CHECKED_OUT, DB_POOL_SIZE, DB_QUERY_DURATION

engine = create_async_engine(settings.database_url, echo=False)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# Track query duration via sync engine events
# (async engine delegates to a sync engine internally)
@event.listens_for(engine.sync_engine, "before_execute")
def _before_execute(conn, clauseelement, multiparams, params, execution_options):
    conn.info["query_start"] = time.perf_counter()


@event.listens_for(engine.sync_engine, "after_execute")
def _after_execute(conn, clauseelement, multiparams, params, execution_options, result):
    start = conn.info.pop("query_start", None)
    if start is not None:
        DB_QUERY_DURATION.observe(time.perf_counter() - start)


def collect_pool_stats() -> None:
    """Update pool gauges. Called from the /metrics endpoint."""
    pool = engine.pool
    DB_POOL_SIZE.set(pool.size())
    DB_POOL_CHECKED_OUT.set(pool.checkedout())


async def get_db():
    async with async_session_factory() as session:
        yield session
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/core/database.py
git commit -m "feat: add SQLAlchemy query timing and pool metrics"
```

---

## Task 8: Register Everything in main.py

**Files:**
- Modify: `apps/api/src/main.py`
- Modify: `apps/api/src/routers/metrics.py` (call collect_pool_stats)

- [ ] **Step 1: Update metrics endpoint to collect pool stats**

In `apps/api/src/routers/metrics.py`, add pool stats collection:

```python
from fastapi import APIRouter, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from src.core.database import collect_pool_stats

router = APIRouter(tags=["metrics"])


@router.get("/metrics")
async def metrics():
    collect_pool_stats()
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )
```

- [ ] **Step 2: Update main.py**

Read `apps/api/src/main.py` first, then:

1. Add imports at the top:
```python
from src.core.logging_config import setup_json_logging
from src.middleware.metrics import MetricsMiddleware
from src.middleware.request_logging import RequestLoggingMiddleware
from src.routers import metrics as metrics_router
```

2. Call `setup_json_logging()` at the top of the lifespan (before any other startup logic):
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_json_logging()
    # ... existing startup code ...
```

3. Register metrics router directly on the app (not on api_router, so it's at `/metrics` not `/api/metrics`):
```python
app.include_router(metrics_router.router)
```

4. Add middlewares. MetricsMiddleware must be added **last** so it wraps everything (outermost):
```python
# After existing middleware registration:
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(MetricsMiddleware)  # Last added = outermost = captures total latency
```

5. Exclude `/metrics` from rate limiting — add to the skip list in the RateLimitMiddleware:
```python
if request.url.path in ("/api/health", "/api/plaid/webhook", "/metrics"):
    return await call_next(request)
```

- [ ] **Step 3: Verify locally**

```bash
cd apps/api && poetry run uvicorn src.main:app --host 0.0.0.0 --port 8888 &
sleep 3
curl -s http://localhost:8888/metrics | head -20
curl -s http://localhost:8888/api/health
curl -s http://localhost:8888/metrics | grep http_requests_total
kill %1
```

Expected: Prometheus text output with `http_requests_total` counter showing the health check request.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/main.py apps/api/src/routers/metrics.py
git commit -m "feat: register metrics, logging, and middleware in main app"
```

---

## Task 9: Tests for Metrics and Logging

**Files:**
- Create: `apps/api/tests/test_metrics.py`

- [ ] **Step 1: Write tests for metrics endpoint and middleware**

Create `apps/api/tests/test_metrics.py`:

```python
import pytest


@pytest.mark.asyncio
async def test_metrics_endpoint_returns_prometheus_format(client):
    resp = await client.get("/metrics")
    assert resp.status_code == 200
    assert "text/plain" in resp.headers.get("content-type", "")
    body = resp.text
    # Should contain default Python process metrics
    assert "process_" in body or "python_" in body


@pytest.mark.asyncio
async def test_metrics_endpoint_tracks_requests(client):
    # Make a request to generate metrics
    await client.get("/api/health")
    resp = await client.get("/metrics")
    assert resp.status_code == 200
    body = resp.text
    assert "http_requests_total" in body


@pytest.mark.asyncio
async def test_metrics_endpoint_excluded_from_rate_limit(client):
    # Call /metrics many times — should never get 429
    for _ in range(20):
        resp = await client.get("/metrics")
        assert resp.status_code == 200
```

- [ ] **Step 2: Run tests**

```bash
cd apps/api && poetry run pytest tests/test_metrics.py -v
```

Expected: PASS (all 3 tests)

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/test_metrics.py
git commit -m "test: add metrics endpoint and middleware tests"
```

---

## Task 10: Business Metric Instrumentation

**Files:**
- Modify: `apps/api/src/routers/auth.py`
- Modify: `apps/api/src/services/plaid.py`
- Modify: `apps/api/src/services/transaction.py`
- Modify: `apps/api/src/services/account.py`
- Modify: `apps/api/src/routers/budgets.py`
- Modify: `apps/api/src/routers/bills.py`

- [ ] **Step 1: Auth counters**

In `apps/api/src/routers/auth.py`:

Add import:
```python
from src.core.metrics import AUTH_LOGIN_FAILURES, AUTH_LOGINS, AUTH_SIGNUPS
```

In the `register` endpoint, after successful user creation (after `user = await register_user(...)`):
```python
AUTH_SIGNUPS.inc()
```

In the `login` endpoint, after successful `create_token_pair`:
```python
AUTH_LOGINS.inc()
```

In the `login` endpoint, in the `except` block (when `authenticate_user` raises):
```python
AUTH_LOGIN_FAILURES.inc()
```

- [ ] **Step 2: Plaid counters**

In `apps/api/src/services/plaid.py`:

Add import:
```python
from src.core.metrics import PLAID_ACCOUNTS_LINKED, PLAID_API_CALLS, PLAID_SYNC
```

In `create_link_token`, before the `asyncio.to_thread` call:
```python
PLAID_API_CALLS.inc()
```

In `exchange_public_token`, before the exchange API call:
```python
PLAID_API_CALLS.inc()
```

After the accounts API call:
```python
PLAID_API_CALLS.inc()
PLAID_ACCOUNTS_LINKED.inc(num_linked)
```

In `sync_transactions`, at the start:
```python
PLAID_API_CALLS.inc()
```

After sync completes successfully:
```python
PLAID_SYNC.labels(status="success").inc()
```

In the sync exception handler:
```python
PLAID_SYNC.labels(status="failure").inc()
```

In `sync_transactions`, after committing new transactions (track Plaid-sourced transactions):
```python
TRANSACTIONS.labels(source="plaid").inc(added_count)
```

(Import `TRANSACTIONS` alongside the other Plaid metrics.)

- [ ] **Step 3: Transaction counters**

In `apps/api/src/services/transaction.py`:

Add import:
```python
from src.core.metrics import TRANSACTIONS
```

In `create_manual_transaction`, after `db.commit()`:
```python
TRANSACTIONS.labels(source="manual").inc()
```

In `import_csv`, after the commit (use the `imported` count):
```python
TRANSACTIONS.labels(source="csv").inc(imported)
```

In `import_ofx`, after the commit:
```python
TRANSACTIONS.labels(source="ofx").inc(imported)
```

- [ ] **Step 4: Account counter**

In `apps/api/src/services/account.py`:

Add import:
```python
from src.core.metrics import TRANSACTIONS
```

In `create_manual_account`, this tracks the account creation. Note: manual accounts don't create transactions, but we track account creation for visibility. Add after `db.commit()`:
```python
# No transaction metric here — manual accounts start with 0 transactions.
# Transaction metrics are tracked in transaction.py when user adds transactions.
```

(Actually, the spec says `services/account.py` should track manual transaction counting, but on review, manual transactions are created in `services/transaction.py::create_manual_transaction` which is already instrumented in Step 3. No change needed to account.py — remove it from the modified files list.)

- [ ] **Step 5: Budget and bill counters**

In `apps/api/src/routers/budgets.py`:

Add import:
```python
from src.core.metrics import BUDGETS_CREATED
```

In `create_budget_endpoint`, after successful creation:
```python
BUDGETS_CREATED.inc()
```

In `apps/api/src/routers/bills.py`:

Add import:
```python
from src.core.metrics import BILLS_CREATED
```

In `create_bill_endpoint`, after successful creation:
```python
BILLS_CREATED.inc()
```

- [ ] **Step 5: Run ruff**

```bash
cd apps/api && poetry run ruff check src/ --fix
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routers/auth.py apps/api/src/services/plaid.py apps/api/src/services/transaction.py apps/api/src/routers/budgets.py apps/api/src/routers/bills.py
git commit -m "feat: instrument business metrics across auth, plaid, transactions, budgets, bills"
```

---

## Task 11: Caddy — Block External /metrics

**Files:**
- Modify: `Caddyfile`

- [ ] **Step 1: Add metrics block before API handler**

In the `{$DOMAIN}` block, add before the existing `handle /api/*`:

```
    # Block /metrics from external access — only Alloy (internal network) should reach it
    handle /metrics {
        respond 403
    }
```

- [ ] **Step 2: Validate Caddyfile**

```bash
docker run --rm -e DOMAIN=example.com -e ACME_EMAIL=test@example.com \
  -v $(pwd)/Caddyfile:/etc/caddy/Caddyfile:ro \
  -v $(pwd)/caddy-sites:/etc/caddy/sites:ro \
  caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Expected: `Valid configuration`

- [ ] **Step 3: Commit**

```bash
git add Caddyfile
git commit -m "feat: block external access to /metrics endpoint via Caddy"
```

---

## Task 12: Grafana Alloy Configuration

**Files:**
- Create: `alloy-config.alloy`
- Modify: `docker-compose.prod.yml`
- Modify: `.env.example`

- [ ] **Step 1: Create Alloy config**

Create `alloy-config.alloy`:

```hcl
// Grafana Alloy configuration for fyNaNs
// Scrapes Prometheus metrics from the API and pushes to Grafana Cloud.
// Tails Docker container logs and pushes to Grafana Cloud Loki.

// --- Prometheus Metrics ---

prometheus.scrape "api" {
  targets = [{
    __address__ = "api:8000",
    job         = "fynans-api",
  }]
  metrics_path = "/metrics"
  scrape_interval = "15s"
  forward_to = [prometheus.remote_write.grafana_cloud.receiver]
}

prometheus.remote_write "grafana_cloud" {
  endpoint {
    url = env("GRAFANA_CLOUD_PROMETHEUS_URL")
    basic_auth {
      username = env("GRAFANA_CLOUD_USER")
      password = env("GRAFANA_CLOUD_API_KEY")
    }
  }
}

// --- Docker Log Collection ---

discovery.docker "containers" {
  host = "unix:///var/run/docker.sock"
}

discovery.relabel "containers" {
  targets = discovery.docker.containers.targets
  rule {
    source_labels = ["__meta_docker_container_name"]
    target_label  = "container"
  }
  rule {
    source_labels = ["__meta_docker_container_name"]
    regex         = "/(.*)"
    target_label  = "container"
  }
}

loki.source.docker "containers" {
  host       = "unix:///var/run/docker.sock"
  targets    = discovery.relabel.containers.output
  forward_to = [loki.write.grafana_cloud.receiver]
}

loki.write "grafana_cloud" {
  endpoint {
    url = env("GRAFANA_CLOUD_LOKI_URL")
    basic_auth {
      username = env("GRAFANA_CLOUD_USER")
      password = env("GRAFANA_CLOUD_API_KEY")
    }
  }
}
```

- [ ] **Step 2: Add Alloy to docker-compose.prod.yml**

Add to the `services:` section:

```yaml
  alloy:
    image: grafana/alloy:v1.8
    restart: unless-stopped
    depends_on:
      api:
        condition: service_healthy
    volumes:
      - ./alloy-config.alloy:/etc/alloy/config.alloy:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - alloy_wal:/var/lib/alloy
    environment:
      GRAFANA_CLOUD_PROMETHEUS_URL: ${GRAFANA_CLOUD_PROMETHEUS_URL}
      GRAFANA_CLOUD_LOKI_URL: ${GRAFANA_CLOUD_LOKI_URL}
      GRAFANA_CLOUD_USER: ${GRAFANA_CLOUD_USER}
      GRAFANA_CLOUD_API_KEY: ${GRAFANA_CLOUD_API_KEY}
    command: run /etc/alloy/config.alloy
    networks:
      - internal
    deploy:
      resources:
        limits:
          memory: 384M
```

Add `alloy_wal` to the `volumes:` section:

```yaml
volumes:
  pgdata:
  caddy_data:
  caddy_config:
  caddy_logs:
  alloy_wal:
```

- [ ] **Step 3: Add env vars to .env.example**

Append to `.env.example`:

```
# Grafana Cloud (observability)
GRAFANA_CLOUD_PROMETHEUS_URL=https://prometheus-prod-XX-XXX.grafana.net/api/prom/push
GRAFANA_CLOUD_LOKI_URL=https://logs-prod-XX.grafana.net/loki/api/v1/push
GRAFANA_CLOUD_USER=<instance-id>
GRAFANA_CLOUD_API_KEY=<service-account-token>
```

- [ ] **Step 4: Commit**

```bash
git add alloy-config.alloy docker-compose.prod.yml .env.example
git commit -m "feat: add Grafana Alloy container and configuration"
```

---

## Task 13: Grafana Dashboards

**Files:**
- Create: `grafana/dashboards/api-overview.json`
- Create: `grafana/dashboards/infrastructure.json`
- Create: `grafana/dashboards/business.json`

- [ ] **Step 1: Create dashboard directory**

```bash
mkdir -p grafana/dashboards
```

- [ ] **Step 2: Create API Overview dashboard**

Create `grafana/dashboards/api-overview.json` with panels:
- Request rate (req/s): `rate(http_requests_total[5m])`
- Error rate (%): `sum(rate(http_requests_total{status_code=~"[45].."}[5m])) / sum(rate(http_requests_total[5m])) * 100` (includes both 4xx and 5xx per spec)
- Latency p50/p95/p99: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`
- Top 10 slowest endpoints (table)
- Requests by status code (stacked time series)
- In-flight requests (gauge)

Build this as a standard Grafana dashboard JSON with 6 panels in a grid layout.

- [ ] **Step 3: Create Infrastructure dashboard**

Create `grafana/dashboards/infrastructure.json` with panels:
- Container CPU usage per service (from Docker metrics via Alloy)
- Container memory usage per service (from Docker metrics via Alloy)
- DB connection pool: `db_pool_size` vs `db_pool_checked_out`
- DB query duration heatmap: `db_query_duration_seconds_bucket`

- [ ] **Step 4: Create Business dashboard**

Create `grafana/dashboards/business.json` with panels:
- Signups over time: `rate(auth_signups_total[1h])`
- Logins over time: `rate(auth_logins_total[1h])`
- Login failure rate: `rate(auth_login_failures_total[1h])`
- Plaid accounts linked: `increase(plaid_accounts_linked_total[24h])`
- Plaid sync success/failure: `rate(plaid_sync_total[1h])` by status label
- Plaid API call count: `plaid_api_calls_total` (single stat for quota tracking)
- Transaction volume by source: `rate(transactions_total[1h])` by source label
- Budgets and bills: `increase(budgets_created_total[24h])`, `increase(bills_created_total[24h])`

- [ ] **Step 5: Commit**

```bash
git add grafana/
git commit -m "feat: add Grafana dashboard JSON definitions"
```

---

## Task 14: Verify End-to-End Locally

- [ ] **Step 1: Start the API locally and verify metrics**

```bash
cd apps/api && poetry run uvicorn src.main:app --host 0.0.0.0 --port 8888 &
sleep 3

# Check health
curl -s http://localhost:8888/api/health

# Check metrics endpoint
curl -s http://localhost:8888/metrics | grep http_requests_total

# Make some requests
curl -s http://localhost:8888/api/health
curl -s http://localhost:8888/api/health
curl -s http://localhost:8888/metrics | grep http_requests_total

kill %1
```

Expected: `http_requests_total` counter shows 2+ for the health endpoint.

- [ ] **Step 2: Verify JSON logs appear on stdout**

Check the uvicorn output for JSON-formatted log lines.

- [ ] **Step 3: Run ruff**

```bash
cd apps/api && poetry run ruff check src/ --fix
```

- [ ] **Step 4: Commit any fixes**

```bash
git add -p && git commit -m "fix: address issues found during local verification"
```
