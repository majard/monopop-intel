from contextlib import asynccontextmanager
from datetime import date, timedelta
import unicodedata

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


# ── Clean Generics v1 + Cross-store Grouping ────────────────────────────────


def make_canonical_key(
    generic_name: str | None,
    parsed_brand: str | None,
    package_size: float | None,
    unit: str | None,
) -> str:
    """
    Cross-store grouping v1 - improved normalization.
    - Brand: remove accents, lowercase, strip
    - Size: consistent .2f or empty
    - Generic and unit: stripped
    """

    def normalize_brand(b: str | None) -> str:
        if not b:
            return ""
        text = unicodedata.normalize("NFKD", b)
        text = "".join(c for c in text if not unicodedata.combining(c))
        return text.strip().lower()

    g = (generic_name or "").strip()
    b = normalize_brand(parsed_brand)
    s = f"{package_size:.2f}" if package_size is not None else ""
    u = (unit or "").strip().lower()

    return f"{g}|{b}|{s}|{u}"


@app.get("/generics")
async def list_generics(
    q: str = Query(None, description="Optional filter by generic name"),
):
    """List all unique generic_names with basic stats."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        query = """
            SELECT 
                generic_name as generic,
                COUNT(*) as count,
                COUNT(CASE WHEN package_size IS NOT NULL THEN 1 END) as with_size,
                COUNT(CASE WHEN is_noise = true THEN 1 END) as noise_count
            FROM products 
            WHERE generic_name IS NOT NULL
        """
        params: list = []

        if q and q.strip():
            query += " AND generic_name ILIKE $1"
            params.append(f"%{q.strip()}%")

        query += " GROUP BY generic_name ORDER BY generic_name ASC"

        rows = await conn.fetch(query, *params)

    return {
        "generics": [dict(r) for r in rows],
        "_meta": {
            "filter": q.strip() if q and q.strip() else None,
            "total": len(rows),
        },
    }


@app.get("/generics/{term}")
async def get_generics(
    term: str,
    store: str = Query(None, description="Filter by store (optional)"),
    exclude_noise: bool = Query(
        True, description="Exclude noise items (default: true)"
    ),
    group: str = Query(
        None,
        description="Grouping mode: 'brand_size' | 'size_only' | 'brand_only' (default: flat list)",
    ),
):
    """
    Clean generics v1 + cross-store grouping.
    Three modes:
    - brand_size : group by brand + size + unit
    - size_only  : group by size + unit, with list of brands inside
    - brand_only : group by brand only, with all sizes/variants inside
    """
    if not term or not term.strip():
        raise HTTPException(status_code=422, detail="Term cannot be empty")

    valid_groups = ("brand_size", "size_only", "brand_only")
    if group and group not in valid_groups:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid group. Use one of: {valid_groups} or omit for flat list.",
        )

    pool = await get_pool()
    fresh_cutoff = date.today() - timedelta(days=7)

    # Build WHERE clause and params dynamically (consistent with history endpoints)
    where = ["p.generic_name = $1"]
    params: list = [term]

    if exclude_noise:
        where.append("p.is_noise = false")

    if store:
        where.append(f"p.store = ${len(params) + 1}")
        params.append(store)

    where_clause = " AND ".join(where)

    # fresh_cutoff is always the last parameter
    params.append(fresh_cutoff)
    fresh_pos = len(params)

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT 
                p.name, 
                p.store, 
                p.parsed_brand, 
                p.package_size, 
                p.unit,
                p.is_noise, 
                p.generic_name,
                MAX(pp.price) as price,
                bool_or(pp.available) as available
            FROM products p
            LEFT JOIN price_points pp 
                ON p.id = pp.product_id 
                AND pp.scrape_date >= ${fresh_pos}
            WHERE {where_clause}
            GROUP BY 
                p.id, p.name, p.store, p.parsed_brand, 
                p.package_size, p.unit, p.is_noise, p.generic_name
            """,
            *params,
        )

    # Build flat products list
    products = []
    for r in rows:
        products.append(
            {
                "name": r["name"],
                "store": r["store"],
                "price": float(r["price"]) if r["price"] is not None else None,
                "package_size": float(r["package_size"])
                if r["package_size"] is not None
                else None,
                "unit": r["unit"],
                "parsed_brand": r["parsed_brand"],
                "is_noise": r["is_noise"],
                "available": bool(r["available"])
                if r["available"] is not None
                else True,
                "canonical_key": make_canonical_key(
                    r["generic_name"], r["parsed_brand"], r["package_size"], r["unit"]
                ),
            }
        )

    products.sort(
        key=lambda x: (not x["available"], x["price"] is None, x["price"] or 0)
    )

    if not group:
        return {
            "generic": term,
            "count": len(products),
            "products": products,
            "_meta": {
                "fresh_cutoff": fresh_cutoff.isoformat(),
                "excluded_noise": exclude_noise,
                "store_filter": store,
            },
        }

    # === GROUPING LOGIC ===
    from collections import defaultdict

    groups: defaultdict = defaultdict(
        lambda: {
            "canonical_key": "",
            "generic": term,
            "brand": None,
            "package_size": None,
            "unit": None,
            "variants": [],
            "price_stats": {"min": None, "max": None, "avg": None},
            "brands": set(),
        }
    )

    for p in products:
        if group == "brand_size":
            key = p["canonical_key"]
            brand_val = p.get("parsed_brand")
            size_val = p.get("package_size")
            unit_val = p.get("unit")
        elif group == "size_only":
            key = make_canonical_key(
                p.get("generic_name"), None, p.get("package_size"), p.get("unit")
            )
            brand_val = None
            size_val = p.get("package_size")
            unit_val = p.get("unit")
        else:  # brand_only
            key = make_canonical_key(
                p.get("generic_name"), p.get("parsed_brand"), None, None
            )
            brand_val = p.get("parsed_brand")
            size_val = None
            unit_val = None

        g = groups[key]
        g["canonical_key"] = key
        g["brand"] = brand_val if group == "brand_size" else None
        g["package_size"] = size_val
        g["unit"] = unit_val

        g["variants"].append(
            {
                "store": p["store"],
                "name": p["name"],
                "price": p["price"],
                "available": p["available"],
                "parsed_brand": p.get("parsed_brand"),
                "package_size": p.get("package_size"),
                "unit": p.get("unit"),
            }
        )

        if p.get("parsed_brand"):
            g["brands"].add(p["parsed_brand"])

    # Finalize groups
    grouped_list = []
    for g in groups.values():
        prices = [
            v["price"]
            for v in g["variants"]
            if v["price"] is not None and v["available"]
        ]
        if prices:
            g["price_stats"] = {
                "min": min(prices),
                "max": max(prices),
                "avg": round(sum(prices) / len(prices), 2),
            }
        else:
            g["price_stats"] = {"min": None, "max": None, "avg": None}

        if group in ("size_only", "brand_only"):
            g["brand"] = sorted(list(g["brands"])) if g["brands"] else None

        del g["brands"]
        grouped_list.append(g)

    return {
        "generic": term,
        "group_mode": group,
        "count": len(grouped_list),
        "groups": grouped_list,
        "_meta": {
            "fresh_cutoff": fresh_cutoff.isoformat(),
            "excluded_noise": exclude_noise,
            "store_filter": store,
        },
    }
