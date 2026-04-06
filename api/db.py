import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

_pool: asyncpg.Pool | None = None


async def get_pool(max_concurrency: int = 10) -> asyncpg.Pool:
    global _pool
    if _pool is None:
        # We set max_size to max_concurrency + 2 for a little 'breathing room'
        # for health checks or manual queries.
        _pool = await asyncpg.create_pool(
            dsn=os.environ["DATABASE_URL"],
            min_size=1,
            max_size=max_concurrency + 2,
        )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def init_schema() -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id                  SERIAL PRIMARY KEY,
                vtex_product_id     TEXT        NOT NULL,
                store               TEXT        NOT NULL,
                name                TEXT        NOT NULL,
                brand               TEXT,
                ean                 TEXT,
                category            TEXT,
                category_path       TEXT,
                measurement_unit    TEXT,
                unit_multiplier     REAL,
                url                 TEXT,
                UNIQUE (vtex_product_id, store)
            );

            CREATE TABLE IF NOT EXISTS price_points (
                id          SERIAL PRIMARY KEY,
                product_id  INTEGER         NOT NULL REFERENCES products(id),
                term        TEXT            NOT NULL,
                price       NUMERIC(10,2),
                list_price  NUMERIC(10,2),
                available   BOOLEAN         NOT NULL DEFAULT true,
                scraped_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
                scrape_date DATE            NOT NULL
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_price_points_daily_unique
                ON price_points (product_id, scrape_date);

            CREATE INDEX IF NOT EXISTS idx_price_points_product_scraped
                ON price_points (product_id, scraped_at DESC);

            CREATE INDEX IF NOT EXISTS idx_price_points_term
                ON price_points (term, scraped_at DESC);

            CREATE TABLE IF NOT EXISTS scrape_log (
                id          SERIAL PRIMARY KEY,
                term        TEXT        NOT NULL,
                store       TEXT        NOT NULL,
                status      TEXT        NOT NULL,
                error       TEXT,
                scraped_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            -- Clean Generics v1 columns (nullable, fully backward compatible)
            ALTER TABLE products 
                ADD COLUMN IF NOT EXISTS generic_name TEXT,
                ADD COLUMN IF NOT EXISTS parsed_brand TEXT,
                ADD COLUMN IF NOT EXISTS package_size REAL,
                ADD COLUMN IF NOT EXISTS unit TEXT,                    -- 'g', 'ml', 'un'
                ADD COLUMN IF NOT EXISTS is_noise BOOLEAN DEFAULT FALSE;
        """)
