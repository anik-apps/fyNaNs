import time
from collections import defaultdict

from fastapi import HTTPException, Request


class InMemoryRateLimiter:
    """Simple in-memory rate limiter. Resets on process restart (acceptable for B phase)."""

    def __init__(self):
        # key -> list of timestamps
        self._requests: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str, max_requests: int, window_seconds: int) -> None:
        now = time.time()
        cutoff = now - window_seconds

        # Clean old entries
        self._requests[key] = [t for t in self._requests[key] if t > cutoff]

        if len(self._requests[key]) >= max_requests:
            raise HTTPException(status_code=429, detail="Too many requests")

        self._requests[key].append(now)


rate_limiter = InMemoryRateLimiter()


def rate_limit_login(request: Request) -> None:
    """5 login attempts per minute per IP."""
    client_ip = request.client.host if request.client else "unknown"
    rate_limiter.check(f"login:{client_ip}", max_requests=5, window_seconds=60)


def rate_limit_general(request: Request) -> None:
    """100 requests per minute per IP."""
    client_ip = request.client.host if request.client else "unknown"
    rate_limiter.check(f"general:{client_ip}", max_requests=100, window_seconds=60)
