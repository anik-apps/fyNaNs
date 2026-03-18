from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from src.core.config import settings
from src.core.rate_limit import rate_limiter
from src.routers import accounts, auth, categories, health, plaid, transactions, user

app = FastAPI(title="fyNaNs API", version="0.1.0")


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        # Skip rate limiting for health check
        if request.url.path in ("/api/health", "/api/plaid/webhook"):
            return await call_next(request)

        # Per-IP general rate limit (100/min)
        client_ip = request.client.host if request.client else "unknown"
        try:
            rate_limiter.check(f"general:{client_ip}", max_requests=100, window_seconds=60)
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
app.include_router(api_router)
