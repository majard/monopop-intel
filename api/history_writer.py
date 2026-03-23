from datetime import datetime, timezone, date
from db import get_pool


async def upsert_products(products: list[dict]) -> dict[tuple, int]:
    """
    Insert products, ignore conflicts (same vtex_product_id + store).
    Returns a map of (vtex_product_id, store) -> internal product id.
    """
    pool = await get_pool()
    id_map: dict[tuple, int] = {}

    async with pool.acquire() as conn:
        for p in products:
            row = await conn.fetchrow(
                """
                INSERT INTO products (
                    vtex_product_id, store, name, brand, ean,
                    category, category_path,
                    measurement_unit, unit_multiplier, url
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (vtex_product_id, store) DO UPDATE
                SET
                    name = EXCLUDED.name,
                    brand = EXCLUDED.brand,
                    ean = EXCLUDED.ean,
                    category = EXCLUDED.category,
                    category_path = EXCLUDED.category_path,
                    measurement_unit = EXCLUDED.measurement_unit,
                    unit_multiplier = EXCLUDED.unit_multiplier,
                    url = EXCLUDED.url
                RETURNING id
                """,
                p["product_id"],
                p["store"],
                p["name"],
                p["brand"],
                p["ean"] or None,
                p.get("category"),
                p.get("category_path"),
                p.get("measurement_unit"),
                p.get("unit_multiplier"),
                p["url"],
            )

            id_map[(p["product_id"], p["store"])] = row["id"]

    return id_map


async def insert_price_points(
    products: list[dict],
    id_map: dict[tuple, int],
    term: str,
    today: date,
) -> None:
    """
    Insert one price_point row per product observation.
    Skips if already exists for today (ON CONFLICT DO NOTHING).
    """
    pool = await get_pool()
    now = datetime.now(timezone.utc)

    async with pool.acquire() as conn:
        await conn.executemany(
            """
            INSERT INTO price_points (product_id, term, price, list_price, available, scraped_at, scrape_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (product_id, scrape_date) DO NOTHING
            """,
            [
                (
                    id_map[(p["product_id"], p["store"])],
                    term,
                    p["price"],
                    p["list_price"],
                    p["available"],
                    now,
                    today,
                )
                for p in products
                if (p["product_id"], p["store"]) in id_map
            ],
        )


async def log_scrape(
    term: str, store: str, status: str, error: str | None = None
) -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO scrape_log (term, store, status, error)
            VALUES ($1, $2, $3, $4)
            """,
            term,
            store,
            status,
            error,
        )
