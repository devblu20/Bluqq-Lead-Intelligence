import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool
from contextlib import contextmanager
from src.config.settings import get_settings

settings = get_settings()

pool = ThreadedConnectionPool(
    minconn=1,
    maxconn=10,
    dsn=settings.DATABASE_URL,
    sslmode="require"
)


@contextmanager
def get_db():
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
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