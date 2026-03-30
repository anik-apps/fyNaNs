"""Pure ASGI middleware for HTTP request metrics."""

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
        status_code = 500

        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
            await send(message)

        # Get normalized route path
        route_path = path
        if "app" in scope:
            app_instance = scope["app"]
            for route in getattr(app_instance, "routes", []):
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
            HTTP_REQUEST_DURATION.labels(method=method, endpoint=route_path).observe(duration)
