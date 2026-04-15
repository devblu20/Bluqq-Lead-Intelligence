import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool
from contextlib import contextmanager
from src.config.settings import get_settings

settings = get_settings()

pool = ThreadedConnectionPool(
    minconn=1,
    maxconn=10,
    dsn=settings.DATABASE_URL + "?sslmode=require",  # ✅ sslmode in DSN
)

def _get_valid_conn():
    """Get a connection from pool, replacing it if it's stale/dead."""
    conn = pool.getconn()
    try:
        # Ping the connection — raises if it's dead
        conn.cursor().execute("SELECT 1")
        return conn
    except Exception:
        # Discard the broken connection and get a fresh one
        try:
            pool.putconn(conn, close=True)
        except Exception:
            pass
        # Create a brand new connection and register it with the pool
        conn = pool.getconn()
        return conn

@contextmanager
def get_db():
    conn = _get_valid_conn()  # ✅ validated connection
    try:
        yield conn
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        pool.putconn(conn)

def query(sql: str, params=None, fetch: str = "all"):
    with get_db() as conn:
        with conn.cursor(
            cursor_factory=psycopg2.extras.RealDictCursor
        ) as cur:
            cur.execute(sql, params or ())
            if fetch == "one":
                return cur.fetchone()
            elif fetch == "all":
                return cur.fetchall()
            elif fetch == "none":
                return None