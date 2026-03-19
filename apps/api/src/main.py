import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from src.core.config import settings
from src.core.rate_limit import GENERAL_RATE_LIMIT, rate_limiter
from src.routers import (
    accounts,
    auth,
    bills,
    budgets,
    categories,
    device_tokens,
    health,
    notifications,
    plaid,
    transactions,
    user,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app):
    # Startup
    try:
        from src.jobs.scheduler import scheduler, setup_jobs

        setup_jobs()
        scheduler.start()
        logger.info("APScheduler started")
    except Exception:
        logger.warning("APScheduler failed to start (non-fatal)", exc_info=True)
    yield
    # Shutdown
    try:
        from src.jobs.scheduler import scheduler

        scheduler.shutdown()
        logger.info("APScheduler shut down")
    except Exception:
        pass


app = FastAPI(title="fyNaNs API", version="0.1.0", lifespan=lifespan)


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        # Skip rate limiting for health check
        if request.url.path in ("/api/health", "/api/plaid/webhook"):
            return await call_next(request)

        # Per-IP general rate limit (100/min)
        client_ip = request.client.host if request.client else "unknown"
        try:
            rate_limiter.check(
                f"general:{client_ip}", max_requests=GENERAL_RATE_LIMIT, window_seconds=60
            )
        except Exception:
            return JSONResponse(status_code=429, content={"detail": "Too many requests"})

        return await call_next(request)


app.add_middleware(RateLimitMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(user.router)
api_router.include_router(plaid.router)
api_router.include_router(accounts.router)
api_router.include_router(transactions.router)
api_router.include_router(categories.router)
api_router.include_router(budgets.router)
api_router.include_router(bills.router)
api_router.include_router(notifications.router)
api_router.include_router(device_tokens.router)
app.include_router(api_router)
