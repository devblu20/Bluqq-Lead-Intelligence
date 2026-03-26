"""
BluQQ Retry & Error Handling Module
─────────────────────────────────────
Exponential backoff retry logic for all external API calls.
Network failures, timeouts, rate limits sab handle karta hai.
"""

import asyncio
import logging
import time
import functools
from datetime import datetime

log = logging.getLogger("bluqq")


# ─────────────────────────────────────────────────────────────────────────────
# RETRY CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

class RetryConfig:
    """Har service ke liye alag retry settings."""

    OPENAI = dict(
        max_attempts = 3,
        base_delay   = 1.0,    # seconds
        max_delay    = 10.0,
        backoff      = 2.0,    # exponential multiplier
        exceptions   = (Exception,)
    )

    REDIS = dict(
        max_attempts = 2,
        base_delay   = 0.5,
        max_delay    = 3.0,
        backoff      = 2.0,
        exceptions   = (Exception,)
    )

    TWILIO = dict(
        max_attempts = 3,
        base_delay   = 1.0,
        max_delay    = 8.0,
        backoff      = 2.0,
        exceptions   = (Exception,)
    )

    CALENDAR = dict(
        max_attempts = 2,
        base_delay   = 1.0,
        max_delay    = 5.0,
        backoff      = 2.0,
        exceptions   = (Exception,)
    )

    TOOL = dict(
        max_attempts = 2,
        base_delay   = 0.5,
        max_delay    = 3.0,
        backoff      = 2.0,
        exceptions   = (Exception,)
    )


# ─────────────────────────────────────────────────────────────────────────────
# ASYNC RETRY DECORATOR
# ─────────────────────────────────────────────────────────────────────────────

def async_retry(
    max_attempts: int   = 3,
    base_delay:   float = 1.0,
    max_delay:    float = 10.0,
    backoff:      float = 2.0,
    exceptions:   tuple = (Exception,),
    fallback             = None,
    service_name: str   = ""
):
    """
    Async function pe retry lagao.

    Usage:
        @async_retry(**RetryConfig.OPENAI, service_name="OpenAI")
        async def call_openai():
            ...
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            delay = base_delay

            for attempt in range(1, max_attempts + 1):
                try:
                    return await func(*args, **kwargs)

                except exceptions as e:
                    last_exception = e
                    err_type = type(e).__name__
                    svc = service_name or func.__name__

                    if attempt < max_attempts:
                        log.warning(
                            f"[Retry] {svc} failed (attempt {attempt}/{max_attempts}): "
                            f"{err_type}: {str(e)[:80]}"
                        )
                        log.info(f"[Retry] Waiting {delay:.1f}s before retry...")
                        await asyncio.sleep(delay)
                        delay = min(delay * backoff, max_delay)
                    else:
                        log.error(
                            f"[Retry] {svc} failed after {max_attempts} attempts: "
                            f"{err_type}: {str(e)[:80]}"
                        )

            # Saare attempts fail — fallback use karo
            if fallback is not None:
                log.info(f"[Retry] Using fallback for {service_name or func.__name__}")
                if callable(fallback):
                    return fallback()
                return fallback

            raise last_exception

        return wrapper
    return decorator


# ─────────────────────────────────────────────────────────────────────────────
# SYNC RETRY DECORATOR
# ─────────────────────────────────────────────────────────────────────────────

def sync_retry(
    max_attempts: int   = 3,
    base_delay:   float = 1.0,
    max_delay:    float = 10.0,
    backoff:      float = 2.0,
    exceptions:   tuple = (Exception,),
    fallback             = None,
    service_name: str   = ""
):
    """Sync functions ke liye retry."""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            delay = base_delay

            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    svc = service_name or func.__name__
                    if attempt < max_attempts:
                        log.warning(
                            f"[Retry] {svc} attempt {attempt}/{max_attempts} failed: "
                            f"{type(e).__name__}: {str(e)[:60]}"
                        )
                        time.sleep(delay)
                        delay = min(delay * backoff, max_delay)
                    else:
                        log.error(f"[Retry] {svc} failed after {max_attempts} attempts")

            if fallback is not None:
                if callable(fallback):
                    return fallback()
                return fallback

            raise last_exception

        return wrapper
    return decorator


# ─────────────────────────────────────────────────────────────────────────────
# ERROR TRACKER — Errors count karo aur alert karo
# ─────────────────────────────────────────────────────────────────────────────

class ErrorTracker:
    """
    Call ke dauran errors track karo.
    Agar bohot zyada errors aaye toh alert karo.
    """

    def __init__(self, session_id: str):
        self.session_id  = session_id
        self.errors      = []
        self.warn_count  = 0
        self.error_count = 0

    def record(self, source: str, error: Exception, severity: str = "error"):
        entry = {
            "timestamp": datetime.now().isoformat(),
            "source":    source,
            "type":      type(error).__name__,
            "message":   str(error)[:200],
            "severity":  severity
        }
        self.errors.append(entry)

        if severity == "warning":
            self.warn_count  += 1
            log.warning(f"[Error] {source}: {type(error).__name__}: {str(error)[:80]}")
        else:
            self.error_count += 1
            log.error(f"[Error] {source}: {type(error).__name__}: {str(error)[:80]}")

        # Zyada errors aaye toh alert
        if self.error_count >= 5:
            log.critical(
                f"[Error] Session {self.session_id} has {self.error_count} errors — "
                f"consider investigation"
            )

    def summary(self) -> dict:
        return {
            "total_errors":   self.error_count,
            "total_warnings": self.warn_count,
            "errors":         self.errors
        }

    def has_critical_errors(self) -> bool:
        return self.error_count >= 3


# ─────────────────────────────────────────────────────────────────────────────
# SAFE WRAPPERS — Common operations ke liye
# ─────────────────────────────────────────────────────────────────────────────

async def safe_openai_update(openai_conn, session_data: dict, tracker: ErrorTracker) -> bool:
    """OpenAI session update with retry."""
    for attempt in range(3):
        try:
            await openai_conn.session.update(session=session_data)
            return True
        except Exception as e:
            tracker.record("openai_session_update", e)
            if attempt < 2:
                await asyncio.sleep(1.0 * (attempt + 1))
    return False


async def safe_openai_send_audio(openai_conn, audio_b64: str, tracker: ErrorTracker) -> bool:
    """Audio chunk OpenAI ko bhejo with retry."""
    for attempt in range(2):
        try:
            await openai_conn.input_audio_buffer.append(audio=audio_b64)
            return True
        except Exception as e:
            tracker.record("openai_audio_send", e, "warning")
            if attempt < 1:
                await asyncio.sleep(0.1)
    return False


async def safe_twilio_send(twilio_ws, message: str, tracker: ErrorTracker) -> bool:
    """Twilio WebSocket pe message bhejo with retry."""
    for attempt in range(3):
        try:
            await twilio_ws.send_text(message)
            return True
        except Exception as e:
            tracker.record("twilio_send", e)
            if attempt < 2:
                await asyncio.sleep(0.5 * (attempt + 1))
    log.error("[Error] Failed to send to Twilio after 3 attempts")
    return False


def safe_redis_op(operation, *args, fallback=None, tracker: ErrorTracker = None, **kwargs):
    """Redis operation with error handling."""
    try:
        return operation(*args, **kwargs)
    except Exception as e:
        if tracker:
            tracker.record("redis", e, "warning")
        else:
            log.warning(f"[Redis] Operation failed: {e}")
        return fallback


async def safe_tool_execute(tool_func, *args, tracker: ErrorTracker = None, **kwargs) -> dict:
    """Tool execution with retry."""
    for attempt in range(2):
        try:
            result = await tool_func(*args, **kwargs)
            return result
        except Exception as e:
            if tracker:
                tracker.record("tool_execute", e)
            else:
                log.error(f"[Tool] Execution failed: {e}")
            if attempt < 1:
                await asyncio.sleep(0.5)

    return {
        "status":  "error",
        "message": "Service temporarily unavailable. Please try again or contact BluQQ directly."
    }


# ─────────────────────────────────────────────────────────────────────────────
# CIRCUIT BREAKER — Service down hone pe temporarily disable karo
# ─────────────────────────────────────────────────────────────────────────────

class CircuitBreaker:
    """
    Agar koi service repeatedly fail kare toh
    temporarily band karo — unnecessary calls avoid karo.
    """

    CLOSED   = "CLOSED"    # Normal — requests allow
    OPEN     = "OPEN"      # Tripped — requests block
    HALF_OPEN= "HALF_OPEN" # Testing — ek request allow

    def __init__(self, name: str, failure_threshold: int = 3, timeout: float = 30.0):
        self.name              = name
        self.failure_threshold = failure_threshold
        self.timeout           = timeout
        self.state             = self.CLOSED
        self.failure_count     = 0
        self.last_failure_time = None

    def call_succeeded(self):
        self.failure_count     = 0
        self.state             = self.CLOSED

    def call_failed(self):
        self.failure_count    += 1
        self.last_failure_time = time.time()

        if self.failure_count >= self.failure_threshold:
            self.state = self.OPEN
            log.warning(
                f"[CircuitBreaker] {self.name} OPEN — "
                f"{self.failure_count} failures, blocking requests for {self.timeout}s"
            )

    def can_attempt(self) -> bool:
        if self.state == self.CLOSED:
            return True

        if self.state == self.OPEN:
            # Timeout ke baad half-open try karo
            if time.time() - self.last_failure_time >= self.timeout:
                self.state = self.HALF_OPEN
                log.info(f"[CircuitBreaker] {self.name} HALF-OPEN — testing")
                return True
            return False

        # HALF_OPEN — allow one attempt
        return True

    @property
    def is_open(self) -> bool:
        return not self.can_attempt()


# Global circuit breakers
cb_openai   = CircuitBreaker("OpenAI",   failure_threshold=3, timeout=30)
cb_redis    = CircuitBreaker("Redis",    failure_threshold=5, timeout=10)
cb_twilio   = CircuitBreaker("Twilio",   failure_threshold=3, timeout=20)
cb_calendar = CircuitBreaker("Calendar", failure_threshold=2, timeout=60)


if __name__ == "__main__":
    import asyncio
    logging.basicConfig(level=logging.INFO)

    print("Retry Module Test\n" + "─" * 40)

    # Test retry decorator
    call_count = 0

    @async_retry(max_attempts=3, base_delay=0.1, service_name="TestService")
    async def flaky_function():
        global call_count
        call_count += 1
        if call_count < 3:
            raise Exception(f"Simulated failure #{call_count}")
        return "success"

    result = asyncio.run(flaky_function())
    print(f"Result: {result} (took {call_count} attempts)")

    # Test circuit breaker
    cb = CircuitBreaker("Test", failure_threshold=2, timeout=1)
    print(f"\nCircuit breaker test:")
    print(f"  Can attempt: {cb.can_attempt()}")
    cb.call_failed()
    cb.call_failed()
    print(f"  After 2 failures: {cb.state}")
    print(f"  Can attempt: {cb.can_attempt()}")