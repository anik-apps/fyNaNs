# Observability: Metrics, Logs & Grafana Dashboards

**Date:** 2026-03-25
**Status:** Draft

## Overview

Add full observability to fyNaNs — operational metrics, business metrics, structured JSON logging, and three Grafana Cloud dashboards. Uses Grafana Cloud free tier (no self-hosted infra) with Grafana Alloy as the local collection agent.

## Goals

- Operational visibility: request latency, error rates, DB performance, container health
- Business analytics: signups, logins, Plaid usage/quota, transaction volume
- Centralized structured logs searchable in Grafana Cloud Loki
- Three provisioned dashboards covering API, infrastructure, and business metrics

## Non-Goals

- Distributed tracing (OpenTelemetry/Jaeger) — future work
- Error tracking (Sentry) — future work
- Frontend (web/mobile) observability — backend only for now
- Alerting rules — dashboards first, alerts later

## Architecture

```
FastAPI App                          Grafana Cloud
───────────                          ────────────
prometheus_client  ──scrape──→  Grafana Alloy  ──push──→  Grafana Cloud Prometheus
python-json-logger ──stdout──→  Grafana Alloy  ──push──→  Grafana Cloud Loki
Docker stats       ──collect─→  Grafana Alloy  ──push──→  Grafana Cloud Prometheus
                                (container on VM)
```

Grafana Alloy runs as a Docker container alongside the app. It:
- Scrapes Prometheus metrics from FastAPI's `/metrics` endpoint every 15 seconds
- Tails Docker container stdout (JSON logs) and pushes to Grafana Cloud Loki
- Collects Docker container resource metrics (CPU, memory) and pushes to Prometheus
- Uses a small WAL (Write-Ahead Log) volume to buffer data when Grafana Cloud is unreachable. Without it, metrics/logs are lost on container restart during an outage.

## Backend Changes

### 1. Dependencies

Add to `apps/api/pyproject.toml`:
- `prometheus-client` — Prometheus metric types and exposition
- `python-json-logger` — JSON formatter for standard logging

### 2. Metrics Definitions

New file: `apps/api/src/core/metrics.py`

All Prometheus metric objects defined in one place:

**Operational metrics:**
- `http_requests_total` (Counter) — labels: method, endpoint, status_code
- `http_request_duration_seconds` (Histogram) — labels: method, endpoint
- `http_requests_in_progress` (Gauge)
- `db_query_duration_seconds` (Histogram)
- `db_pool_size` (Gauge)
- `db_pool_checked_out` (Gauge)

**Business metrics:**
- `auth_signups_total` (Counter)
- `auth_logins_total` (Counter)
- `auth_login_failures_total` (Counter)
- `plaid_accounts_linked_total` (Counter)
- `plaid_sync_total` (Counter) — labels: status (success/failure)
- `plaid_api_calls_total` (Counter)
- `transactions_total` (Counter) — labels: source (plaid/csv/ofx/manual)
- `budgets_created_total` (Counter)
- `bills_created_total` (Counter)

### 3. JSON Logging Configuration

New file: `apps/api/src/core/logging_config.py`

Configure `python-json-logger` as the root logging formatter. Every log line outputs JSON:
```json
{"timestamp": "2026-03-25T12:00:00Z", "level": "INFO", "logger": "src.routers.plaid", "message": "Webhook received"}
```

Called once during app startup in `main.py`.

### 4. Request Metrics Middleware

New file: `apps/api/src/middleware/metrics.py`

Pure ASGI middleware (not `BaseHTTPMiddleware`, which has known issues with streaming responses) that wraps every request:
- Increments `http_requests_total` with method, normalized endpoint path, status code
- Observes `http_request_duration_seconds`
- Tracks `http_requests_in_progress` gauge
- Uses `request.scope["route"].path` for endpoint normalization (e.g., `/api/accounts/{account_id}`) to avoid cardinality explosion — no regex needed

### 5. Request Logging Middleware

New file: `apps/api/src/middleware/request_logging.py`

Pure ASGI middleware that logs every request as structured JSON:
- Fields: method, path, status_code, duration_ms, client_ip
- Skips `/metrics` and `/api/health` to avoid log noise

### 6. Metrics Endpoint

New file: `apps/api/src/routers/metrics.py`

`GET /metrics` — standard Prometheus text exposition format. Excluded from auth, rate limiting, and request logging. Blocked from external access via Caddy: add a `handle /metrics` block that returns 403 before the API proxy rule. Only Alloy (on the internal Docker network) can reach it.

### 7. Database Metrics

Modify: `apps/api/src/core/database.py`

Add SQLAlchemy event listeners on the async engine:
- `before_execute` / `after_execute` events on `AsyncConnection` — observe `db_query_duration_seconds`. Note: `before_cursor_execute`/`after_cursor_execute` do NOT work with asyncpg; must use connection-level events.
- Pool stats collection via `pool.status()` — update `db_pool_size` and `db_pool_checked_out` gauges, called from the metrics endpoint or a background task.

Note: assumes single Uvicorn worker (current setup). `prometheus_client` multiprocess mode would be needed for multiple workers.

### 8. Business Metric Instrumentation

Increment counters at the service/router layer:

| File | Metrics |
|------|---------|
| `routers/auth.py` | `auth_signups_total`, `auth_logins_total`, `auth_login_failures_total` |
| `services/plaid.py` | `plaid_accounts_linked_total`, `plaid_sync_total`, `plaid_api_calls_total` |
| `services/transaction.py` | `transactions_total` (label by source) |
| `services/account.py` | (transactions_total for manual accounts) |
| `routers/budgets.py` | `budgets_created_total` |
| `routers/bills.py` | `bills_created_total` |

Each instrumentation is a single `metric.inc()` or `metric.labels(...).inc()` call — minimal code change per file.

### 9. Main App Registration

Modify: `apps/api/src/main.py`

- Call `setup_json_logging()` at startup
- Add `MetricsMiddleware` **last** (so it wraps all other middleware and captures accurate total latency) and `RequestLoggingMiddleware`
- Register metrics router
- Exclude `/metrics` from rate limiting

## Infrastructure Changes

### 10. Grafana Alloy Container

Modify: `docker-compose.prod.yml`

Add Alloy service:
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

Add `alloy_wal` to the volumes section. The WAL buffers metrics/logs when Grafana Cloud is unreachable.

### 11. Alloy Configuration

New file: `alloy-config.alloy`

Alloy HCL config that:
- Scrapes `http://api:8000/metrics` every 15 seconds
- Discovers Docker containers and tails their stdout logs
- Labels logs with service name, container name
- Remote-writes metrics to `GRAFANA_CLOUD_PROMETHEUS_URL`
- Pushes logs to `GRAFANA_CLOUD_LOKI_URL`
- Authenticates with `GRAFANA_CLOUD_USER` / `GRAFANA_CLOUD_API_KEY`

### 12. Environment Variables

Add to `.env.example`:
```
GRAFANA_CLOUD_PROMETHEUS_URL=https://prometheus-prod-XX-XXX.grafana.net/api/prom/push
GRAFANA_CLOUD_LOKI_URL=https://logs-prod-XX.grafana.net/loki/api/v1/push
GRAFANA_CLOUD_USER=<instance-id>
GRAFANA_CLOUD_API_KEY=<service-account-token>
```

## Grafana Dashboards

Three dashboard JSON files stored in `grafana/dashboards/` and importable to Grafana Cloud.

### Dashboard 1: API Overview
- Request rate (req/s) over time
- Error rate (%) — 4xx and 5xx
- Latency percentiles (p50, p95, p99)
- Top 10 slowest endpoints table
- Requests by status code (stacked bar)
- In-flight requests gauge

### Dashboard 2: Infrastructure
- Container CPU usage per service (api, web, db, caddy, alloy)
- Container memory usage per service
- DB connection pool size vs checked-out
- DB query duration heatmap

### Dashboard 3: Business
- Signups and logins over time (line chart)
- Auth failure rate
- Plaid accounts linked (cumulative and rate)
- Plaid sync success/failure ratio
- Plaid API call count (quota tracking — 200 free calls)
- Transaction volume by source (stacked area: Plaid vs CSV vs manual)
- Budgets and bills created over time

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `apps/api/src/core/metrics.py` | All Prometheus metric definitions |
| `apps/api/src/core/logging_config.py` | JSON logging setup |
| `apps/api/src/middleware/metrics.py` | Request metrics middleware |
| `apps/api/src/middleware/request_logging.py` | Request logging middleware |
| `apps/api/src/routers/metrics.py` | `/metrics` endpoint |
| `alloy-config.alloy` | Grafana Alloy scrape/push config |
| `grafana/dashboards/api-overview.json` | API dashboard |
| `grafana/dashboards/infrastructure.json` | Infra dashboard |
| `grafana/dashboards/business.json` | Business dashboard |

### Modified Files
| File | Change |
|------|--------|
| `apps/api/pyproject.toml` | Add prometheus-client, python-json-logger |
| `apps/api/src/main.py` | Register middlewares, logging, metrics route |
| `apps/api/src/core/database.py` | SQLAlchemy event hooks for DB metrics |
| `apps/api/src/routers/auth.py` | Increment auth counters |
| `apps/api/src/services/plaid.py` | Increment Plaid counters |
| `apps/api/src/services/transaction.py` | Increment transaction counters |
| `apps/api/src/services/account.py` | Increment manual transaction counter |
| `apps/api/src/routers/budgets.py` | Increment budget counter |
| `apps/api/src/routers/bills.py` | Increment bill counter |
| `docker-compose.prod.yml` | Add Alloy service + alloy_wal volume |
| `Caddyfile` | Block external access to `/metrics` |
| `.env.example` | Add Grafana Cloud env vars |

## Setup Steps (Post-Deploy)

1. Create a free Grafana Cloud account at grafana.com
2. Get Prometheus remote-write URL, Loki push URL, instance ID, and API key
3. Set the 4 env vars on the server
4. `docker compose -f docker-compose.prod.yml up -d alloy`
5. Import the 3 dashboard JSON files into Grafana Cloud
6. Verify metrics appear at Explore → Prometheus and logs at Explore → Loki
