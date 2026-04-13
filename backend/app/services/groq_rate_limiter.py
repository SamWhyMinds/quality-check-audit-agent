"""
groq_rate_limiter.py — Centralized Groq API call wrapper with 429 / rate-limit handling.

Design decisions:
  • Single designated API key — no rotation or fallback logic.
  • On RateLimitError (429): parse retry-after from response headers; if absent,
    use the configured cooldown (default 65 s). Sleep, then retry.
  • On other transient errors: exponential backoff (2, 4, 8 … capped at 32 s).
  • State is maintained by the caller — this module only handles the call loop.
  • All rate-limit events are logged at WARNING level for full observability.
"""
from __future__ import annotations

import logging
import time
from typing import Callable, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Safe default: just over Groq's 60-second request window
_DEFAULT_COOLDOWN: int = 65
_DEFAULT_MAX_RETRIES: int = 10   # covers burst → cooldown → burst cycles


# ─── Header parsing ───────────────────────────────────────────────────────────

def _parse_retry_after(exc: Exception) -> int:
    """
    Extract the retry-after seconds from a Groq RateLimitError.
    Checks (in order):
      1. Standard  Retry-After header (seconds)
      2. x-ratelimit-reset-requests  (e.g. "5s", "2500ms", "1m30s")
      3. x-ratelimit-reset-tokens
    Falls back to _DEFAULT_COOLDOWN when nothing is parseable.
    """
    try:
        headers: dict = {}
        if hasattr(exc, "response") and exc.response is not None:  # type: ignore[attr-defined]
            headers = dict(exc.response.headers)  # type: ignore[union-attr]

        # 1. Standard Retry-After
        for key in ("retry-after", "Retry-After"):
            if key in headers:
                try:
                    return max(1, int(float(headers[key]))) + 2
                except (ValueError, TypeError):
                    pass

        # 2 & 3. Groq-specific reset headers
        for key in ("x-ratelimit-reset-requests", "x-ratelimit-reset-tokens"):
            if key in headers:
                v = str(headers[key]).strip().lower()
                try:
                    if v.endswith("ms"):
                        return max(1, int(int(v[:-2]) / 1000)) + 2
                    if v.endswith("m"):
                        return int(float(v[:-1]) * 60) + 2
                    if v.endswith("s"):
                        return max(1, int(float(v[:-1]))) + 2
                except (ValueError, TypeError):
                    pass
    except Exception:
        pass
    return _DEFAULT_COOLDOWN


def _is_rate_limit(exc: Exception) -> bool:
    """Return True when *exc* looks like a Groq 429 / rate-limit error."""
    name = type(exc).__name__
    msg  = str(exc).lower()
    return (
        "ratelimiterror"      in name.lower()
        or "rate_limit"       in msg
        or "rate limit"       in msg
        or "too many request" in msg
        or "429"              in msg
    )


# ─── Public retry wrapper ─────────────────────────────────────────────────────

def groq_call_with_retry(
    call_fn: Callable[[], T],
    *,
    max_retries: int   = _DEFAULT_MAX_RETRIES,
    cooldown:    int   = _DEFAULT_COOLDOWN,
    context:     str   = "",
) -> T:
    """
    Execute ``call_fn()`` with robust retry / back-off logic:

    Rate-limit (429)
        • Parse retry-after from response headers.
        • If absent, sleep for ``cooldown`` seconds.
        • Retry up to ``max_retries`` times — **never rotates the API key**.

    Other transient errors
        • Exponential back-off: 2 s, 4 s, 8 s … capped at 32 s.
        • Re-raised after ``max_retries`` attempts.

    Parameters
    ----------
    call_fn      : zero-arg callable that makes the Groq API request.
    max_retries  : total number of attempts (including the first).
    cooldown     : fallback sleep seconds when retry-after header is absent.
    context      : descriptive tag for log messages (e.g. "D03_Q02 validate").
    """
    ctx      = f" [{context}]" if context else ""
    last_exc: Exception | None = None

    for attempt in range(1, max_retries + 1):
        try:
            return call_fn()

        except Exception as exc:
            last_exc = exc

            if _is_rate_limit(exc):
                wait = _parse_retry_after(exc) or cooldown
                logger.warning(
                    "Groq rate-limit hit%s (attempt %d/%d). "
                    "Pausing %d s before automatic retry…",
                    ctx, attempt, max_retries, wait,
                )
                time.sleep(wait)
                continue   # retry immediately after sleep

            # Non-rate-limit error → exponential back-off
            if attempt < max_retries:
                wait = min(2 ** (attempt - 1), 32)
                logger.warning(
                    "Groq API error%s attempt %d/%d: %s — retrying in %d s.",
                    ctx, attempt, max_retries, str(exc)[:120], wait,
                )
                time.sleep(wait)
            else:
                logger.error(
                    "Groq API call failed%s after %d attempts: %s",
                    ctx, max_retries, str(exc)[:200],
                )

    raise last_exc or RuntimeError("groq_call_with_retry: max retries exceeded")
