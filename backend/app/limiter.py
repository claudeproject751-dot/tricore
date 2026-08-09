"""Shared rate limiter.

Lives in its own module so routers can apply `@limiter.limit(...)` without
importing `main` (which imports the routers — a cycle).

Limits are applied per route rather than as a global default, so `/api/health`
and `/docs` are never throttled: Render's health checks and the frontend's
status indicator poll continuously and must not consume a visitor's budget.
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

from .config import get_settings

settings = get_settings()

# `headers_enabled` is deliberately off. slowapi's decorator injects the
# X-RateLimit-* headers by rebinding its local `response` to whatever the handler
# returned; our handlers return Pydantic models, which sends it down a path that
# raises. We emit the same headers ourselves in main.py's middleware instead,
# from the public `request.state.view_rate_limit` slowapi sets during its check.
limiter = Limiter(key_func=get_remote_address, headers_enabled=False)

#: Applied to the prediction endpoints. e.g. "60/minute".
RATE_LIMIT = settings.rate_limit


def rate_limit_headers(request) -> dict[str, str]:
    """X-RateLimit-* values for a request that passed through a limited route.

    Returns an empty dict for unlimited routes, or if slowapi's storage can't be
    queried — informational headers must never be able to fail a real request.
    """
    current = getattr(request.state, "view_rate_limit", None)
    if current is None:
        return {}
    try:
        item, keys = current
        reset_at, remaining = limiter.limiter.get_window_stats(item, *keys)
        return {
            "X-RateLimit-Limit": str(item.amount),
            "X-RateLimit-Remaining": str(remaining),
            "X-RateLimit-Reset": str(int(reset_at)),
        }
    except Exception:  # noqa: BLE001 - headers are best-effort metadata
        return {}
