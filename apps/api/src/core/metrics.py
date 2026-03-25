"""Prometheus metric definitions for fyNaNs API."""

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
