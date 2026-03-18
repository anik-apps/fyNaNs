import time
from collections import defaultdict

from fastapi import HTTPException, Request

# Maximum window any rate limit uses — used for periodic cleanup
_MAX_WINDOW_SECONDS = 3600  # Longest window used (password reset)
_CLEANUP_INTERVAL = 100  # run cleanup every N check() calls


class InMemoryRateLimiter:
    """Simple in-memory rate limiter. Resets on process restart (acceptable for B phase)."""

    def __init__(self):
        # key -> list of timestamps
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._call_count: int = 0

    def check(self, key: str, max_requests: int, window_seconds: int) -> None:
        now = time.time()
        cutoff = now - window_seconds

        # Clean old entries for this key
        self._requests[key] = [t for t in self._requests[key] if t > cutoff]

        if len(self._requests[key]) >= max_requests:
            raise HTTPException(status_code=429, detail="Too many requests")

        self._requests[key].append(now)

        # Periodic global cleanup to prevent memory leak from abandoned keys
        self._call_count += 1
        if self._call_count >= _CLEANUP_INTERVAL:
            self._cleanup(now)
            self._call_count = 0

    def _cleanup(self, now: float) -> None:
        """Remove all entries older than the max window across all keys."""
        cutoff = now - _MAX_WINDOW_SECONDS
        stale_keys = []
        for key, timestamps in self._requests.items():
            filtered = [t for t in timestamps if t > cutoff]
            if filtered:
                self._requests[key] = filtered
            else:
                stale_keys.append(key)
        for key in stale_keys:
            del self._requests[key]


rate_limiter = InMemoryRateLimiter()


def _get_client_ip(request: Request) -> str:
    """Get real client IP, respecting X-Forwarded-For from trusted proxy (Caddy)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit_login(request: Request) -> None:
    """5 login attempts per minute per IP."""
    client_ip = _get_client_ip(request)
    rate_limiter.check(f"login:{client_ip}", max_requests=5, window_seconds=60)


def rate_limit_general(request: Request) -> None:
    """100 requests per minute per IP."""
    client_ip = _get_client_ip(request)
    rate_limiter.check(f"general:{client_ip}", max_requests=100, window_seconds=60)


def rate_limit_password_reset(request: Request) -> None:
    """3 password reset requests per IP per hour."""
    client_ip = _get_client_ip(request)
    rate_limiter.check(f"pw_reset:{client_ip}", max_requests=3, window_seconds=3600)


def rate_limit_mfa_verify(request: Request) -> None:
    """5 MFA verify attempts per IP per 5 minutes."""
    client_ip = _get_client_ip(request)
    rate_limiter.check(f"mfa_verify:{client_ip}", max_requests=5, window_seconds=300)
