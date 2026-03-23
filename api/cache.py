import hashlib
import json
import time
import unicodedata
from datetime import datetime, timezone
from typing import Any

import aiosqlite

DB_PATH = "price_cache.db"
TTL_SECONDS = 4 * 60 * 60  # 4h


def make_query_key(store: str, query: str, sort: str, page: int) -> str:
    """
    Deterministic cache key from all four search params.
    Normalizes query text so 'Arroz Tipo 1' and 'arroz tipo 1' hit the same row.
    Returns a SHA-256 hex string.
    """
    normalized = (
        unicodedata.normalize("NFKD", query)
        .encode("ascii", "ignore")
        .decode()
        .lower()
        .strip()
    )
    normalized = " ".join(normalized.split())  # collapse internal whitespace
    raw = f"{store}:{normalized}:{sort}:{page}"
    return hashlib.sha256(raw.encode()).hexdigest()


async def init_db(db_path: str = DB_PATH) -> None:
    """Create table + index if they don't exist. Call once at startup."""
    async with aiosqlite.connect(db_path) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS price_cache (
                query_key   TEXT PRIMARY KEY,
                store       TEXT NOT NULL,
                query_text  TEXT NOT NULL,
                result_json TEXT NOT NULL,
                cached_at   REAL NOT NULL
            )
        """)
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_store ON price_cache(store)"
        )
        await db.commit()


async def get_cached(query_key: str, db_path: str = DB_PATH) -> dict[str, Any] | None:
    """
    Returns the cached payload + metadata if the row exists and is fresh.
    Returns None on miss or if the row is older than TTL (and deletes it).
    """
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT result_json, cached_at FROM price_cache WHERE query_key = ?",
            (query_key,),
        ) as cursor:
            row = await cursor.fetchone()

    if row is None:
        return None

    age = time.time() - row["cached_at"]
    if age > TTL_SECONDS:
        # Passive invalidation: delete stale row on read
        async with aiosqlite.connect(db_path) as db:
            await db.execute(
                "DELETE FROM price_cache WHERE query_key = ?", (query_key,)
            )
            await db.commit()
        return None

    return {
        "data": json.loads(row["result_json"]),
        "cached_at": datetime.fromtimestamp(row["cached_at"], tz=timezone.utc).isoformat(),
        "age_seconds": int(age),
    }


async def set_cached(
    query_key: str,
    store: str,
    query_text: str,
    result: Any,
    db_path: str = DB_PATH,
) -> None:
    """Insert or update a cache row with the current timestamp."""
    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            """
            INSERT INTO price_cache (query_key, store, query_text, result_json, cached_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(query_key) DO UPDATE SET
                result_json = excluded.result_json,
                cached_at   = excluded.cached_at
            """,
            (query_key, store, query_text, json.dumps(result), time.time()),
        )
        await db.commit()


async def purge_expired(db_path: str = DB_PATH) -> int:
    """
    Delete all rows older than TTL. Not required for correctness —
    passive invalidation handles freshness. Call this at startup
    to keep the DB file from growing indefinitely.
    """
    cutoff = time.time() - TTL_SECONDS
    async with aiosqlite.connect(db_path) as db:
        cursor = await db.execute(
            "DELETE FROM price_cache WHERE cached_at < ?", (cutoff,)
        )
        await db.commit()
        return cursor.rowcount
