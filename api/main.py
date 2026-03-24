from contextlib import asynccontextmanager
from datetime import date, timedelta

from fastapi import FastAPI, Query, HTTPException

from cache import get_cached, init_db, make_query_key, purge_expired, set_cached
from db import get_pool, init_schema
from scraper.vtex import SORT_OPTIONS, STORES, search_async


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    deleted = await purge_expired()
    if deleted:
        print(f"[cache] purged {deleted} expired rows on startup")
    await init_schema()
    yield


app = FastAPI(
    title="monopop-intel",
    description="Market price intelligence for the Monopop ecosystem.",
    lifespan=lifespan,
)


# ── Search ────────────────────────────────────────────────────────────────────


@app.get("/search")
async def search_products(
    q: str = Query(..., min_length=1, description="Search term"),
    store: str = Query(
        "prezunic", description=f"Available: {list(STORES.keys()) + ['all']}"
    ),
    sort: str = Query(
        "relevance", description=f"Available: {list(SORT_OPTIONS.keys())}"
    ),
    page: int = Query(1, ge=1, description="Page number"),
):
    if not q or not q.strip():
        raise HTTPException(status_code=422, detail="Search term 'q' cannot be empty")

    valid_stores = list(STORES.keys()) + ["all"]
    if store not in valid_stores:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid store '{store}'. Available: {valid_stores}",
        )

    if sort not in SORT_OPTIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid sort '{sort}'. Available: {list(SORT_OPTIONS.keys())}",
        )

    query_key = make_query_key(store, q, sort, page)

    cached = await get_cached(query_key)
    if cached:
        return {
            **cached["data"],
            "_cache": {
                "hit": True,
                "cached_at": cached["cached_at"],
                "age_seconds": cached["age_seconds"],
            },
        }

    result = await search_async(q, store=store, sort=sort, page=page)
    await set_cached(query_key, store, q, result)

    return {**result, "_cache": {"hit": False}}


@app.get("/stores")
def list_stores():
    return {"stores": list(STORES.keys()) + ["all"]}


@app.get("/sort-options")
def list_sort_options():
    return {"sort_options": list(SORT_OPTIONS.keys())}


# ── History ───────────────────────────────────────────────────────────────────


@app.get("/history/terms")
async def list_history_terms():
    """All tracked terms with last scrape time and product count."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT
                pp.term,
                MAX(pp.scraped_at)  AS last_scraped_at,
                COUNT(DISTINCT pp.product_id) AS product_count
            FROM price_points pp
            GROUP BY pp.term
            ORDER BY pp.term ASC
        """)
    return [dict(r) for r in rows]


@app.get("/history/term/{term}")
async def history_by_term(
    term: str,
    store: str = Query(None, description="Filter by store"),
    category: str = Query(None, description="Filter by category"),
    days: int = Query(30, ge=1, le=90, description="Lookback window in days"),
):
    """
    Products for a tracked term with price series and trend indicator.
    Trend: compare latest price vs price 7 days ago. >2% change = up/down, else flat.
    null when fewer than 2 days of data exist.
    """
    pool = await get_pool()
    since = date.today() - timedelta(days=days)

    filters = ["pp.term = $1", "pp.scrape_date >= $2"]
    params: list = [term, since]
    i = 3

    if store:
        filters.append(f"p.store = ${i}")
        params.append(store)
        i += 1

    if category:
        filters.append(f"p.category = ${i}")
        params.append(category)
        i += 1

    where = " AND ".join(filters)

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT
                p.id            AS product_id,
                p.vtex_product_id,
                p.store,
                p.name,
                p.brand,
                p.ean,
                p.category,
                p.url,
                pp.scrape_date  AS date,
                pp.price,
                pp.available
            FROM price_points pp
            JOIN products p ON p.id = pp.product_id
            WHERE {where}
            ORDER BY p.id, pp.scrape_date ASC
        """,
            *params,
        )

    # Group series by product
    products: dict[int, dict] = {}
    for r in rows:
        pid = r["product_id"]
        if pid not in products:
            products[pid] = {
                "product_id": pid,
                "vtex_product_id": r["vtex_product_id"],
                "store": r["store"],
                "name": r["name"],
                "brand": r["brand"],
                "ean": r["ean"],
                "category": r["category"],
                "url": r["url"],
                "price_series": [],
            }
        products[pid]["price_series"].append(
            {
                "date": r["date"].isoformat(),
                "price": float(r["price"]) if r["price"] is not None else None,
                "available": r["available"],
            }
        )

    # Derive current_price, current_available, trend
    result = []
    for p in products.values():
        series = p["price_series"]
        latest = series[-1]
        p["current_price"] = latest["price"]
        p["current_available"] = latest["available"]

        trend = None
        if len(series) >= 2:
            cutoff = (date.today() - timedelta(days=7)).isoformat()
            # Find the most recent point at or before 7 days ago
            past = next((s for s in reversed(series) if s["date"] <= cutoff), None)
            if past and past["price"] and latest["price"]:
                delta = (latest["price"] - past["price"]) / past["price"]
                if delta > 0.02:
                    trend = "up"
                elif delta < -0.02:
                    trend = "down"
                else:
                    trend = "flat"
        p["trend"] = trend
        result.append(p)

    # Sort: available first, then by price ASC
    result.sort(
        key=lambda x: (
            not x["current_available"],  # False (0) before True (1), so negate
            x["current_price"] is None,
            x["current_price"] or 0,
        )
    )

    return {
        "term": term,
        "store": store,
        "category": category,
        "days": days,
        "products": result,
    }


@app.get("/history/product/{product_id}")
async def history_by_product(
    product_id: int,
    days: int = Query(30, ge=1, le=90, description="Lookback window in days"),
):
    """Price series for a single product over the last N days."""
    pool = await get_pool()
    since = date.today() - timedelta(days=days)

    async with pool.acquire() as conn:
        product = await conn.fetchrow(
            "SELECT id, vtex_product_id, store, name, brand, ean, category, url FROM products WHERE id = $1",
            product_id,
        )
        if not product:
            raise HTTPException(
                status_code=404, detail=f"Product {product_id} not found"
            )

        series = await conn.fetch(
            """
            SELECT scrape_date AS date, price, available
            FROM price_points
            WHERE product_id = $1 AND scrape_date >= $2
            ORDER BY scrape_date ASC
        """,
            product_id,
            since,
        )

    return {
        **dict(product),
        "days": days,
        "series": [
            {
                "date": r["date"].isoformat(),
                "price": float(r["price"]) if r["price"] is not None else None,
                "available": r["available"],
            }
            for r in series
        ],
    }
