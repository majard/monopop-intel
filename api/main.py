from contextlib import asynccontextmanager
from datetime import date, timedelta
import unicodedata

from fastapi import FastAPI, Query, HTTPException

from cache import get_cached, init_db, make_query_key, purge_expired, set_cached
from db import get_pool, init_schema
from scraper.vtex import SORT_OPTIONS, STORES, search_async

from fastapi.middleware.cors import CORSMiddleware


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://monopop-intel.vercel.app",
        "http://localhost:3000",
    ],
    allow_origin_regex=r"https://monopop-intel.*\.vercel\.app",
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ── Search ────────────────────────────────────────────────────────────────────


async def enrich_with_generics(results: list[dict]) -> list[dict]:
    """
    Looks up generic_name and internal db id for each result by vtex_product_id + store.
    Products not in DB get generic_name=None, db_id=None — frontend handles gracefully.
    """
    if not results:
        return results

    pool = await get_pool()
    vtex_ids = [(r["product_id"], r["store"]) for r in results]

    print("enriching with generics", vtex_ids)


    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT vtex_product_id, store, id, generic_name
            FROM products
            WHERE (vtex_product_id, store) IN (
                SELECT * FROM UNNEST($1::text[], $2::text[])
            )
            """,
            [r[0] for r in vtex_ids],
            [r[1] for r in vtex_ids],
        )

    print("rows", rows)
    lookup = {(r["vtex_product_id"], r["store"]): r for r in rows}

    enriched = []
    for r in results:
        match = lookup.get((r["product_id"], r["store"]))
        enriched.append({
            **r,
            "db_id": match["id"] if match else None,
            "generic_name": match["generic_name"] if match else None,
        })
    return enriched

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
    print("result", result)
    page_results = await enrich_with_generics(result["results"])
    result["results"] = page_results

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
        None, description="Grouping mode: 'brand_size' | 'size_only' | 'brand_only'"
    ),
    sort_by: str = Query(
        "price", description="Sort by: 'price' (total) or 'price_per_unit'"
    ),
):
    """
    Clean generics v1 + cross-store grouping with price-per-unit normalization.
    Supports both grouped and flat modes with consistent sorting.
    Now includes url, ean, category, brand and vtex_product_id for drill-down pages.
    """
    if not term or not term.strip():
        raise HTTPException(status_code=422, detail="Term cannot be empty")

    valid_groups = ("brand_size", "size_only", "brand_only")
    if group and group not in valid_groups:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid group. Use one of: {valid_groups} or omit for flat list.",
        )

    if sort_by not in ("price", "price_per_unit"):
        sort_by = "price"

    pool = await get_pool()
    fresh_cutoff = date.today() - timedelta(days=7)

    # Build WHERE clause
    where = ["p.generic_name = $1"]
    params: list = [term]

    if exclude_noise:
        where.append("p.is_noise = false")
    if store:
        where.append(f"p.store = ${len(params) + 1}")
        params.append(store)

    where_clause = " AND ".join(where)
    params.append(fresh_cutoff)
    fresh_pos = len(params)

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT 
                p.id,
                p.vtex_product_id,
                p.name,
                p.store,
                p.brand,
                p.ean,
                p.category,
                p.url,
                p.parsed_brand,
                p.package_size,
                p.unit,
                p.is_noise,
                p.generic_name,
                pp_latest.price,
                pp_latest.list_price,
                pp_latest.available
            FROM products p
            LEFT JOIN LATERAL (
                SELECT price, list_price, available
                FROM price_points
                WHERE product_id = p.id AND scrape_date >= ${fresh_pos}
                ORDER BY scrape_date DESC
                LIMIT 1
            ) pp_latest ON true
            WHERE {where_clause}
            """,
            *params,
        )

    # Build enriched products
    products = []
    for r in rows:
        price = float(r["price"]) if r["price"] is not None else None
        size = float(r["package_size"]) if r["package_size"] is not None else None
        unit = r["unit"]

        price_per_unit = None
        normalized_size = None
        display_per_unit = None

        if price is not None and size is not None and size > 0 and unit:
            if unit == "g":
                price_per_g = price / size
                price_per_unit = price_per_g
                if size >= 1000:
                    normalized_size = f"{size / 1000:.1f} kg".replace(".0", "")
                    display_per_unit = f"R$ {price_per_g * 1000:.2f}/kg"
                else:
                    normalized_size = f"{size:.0f} g"
                    display_per_unit = f"R$ {price_per_g * 1000:.2f}/kg"
            elif unit == "ml":
                price_per_ml = price / size
                price_per_unit = price_per_ml
                if size >= 1000:
                    normalized_size = f"{size / 1000:.1f} L".replace(".0", "")
                    display_per_unit = f"R$ {price_per_ml * 1000:.2f}/L"
                else:
                    normalized_size = f"{size:.0f} ml"
                    display_per_unit = f"R$ {price_per_ml * 1000:.2f}/L"
            else:
                normalized_size = f"{size}{unit}"
                price_per_unit = price / size
                display_per_unit = f"R$ {price_per_unit:.2f}/{unit}"

        products.append(
            {
                "product_id": r["id"],
                "vtex_product_id": r["vtex_product_id"],
                "name": r["name"],
                "store": r["store"],
                "brand": r["brand"],
                "ean": r["ean"],
                "category": r["category"],
                "url": r["url"],
                "parsed_brand": r["parsed_brand"],
                "price": price,
                "list_price": float(r["list_price"])
                if r["list_price"] is not None
                else None,
                "package_size": size,
                "unit": unit,
                "available": bool(r["available"])
                if r["available"] is not None
                else True,
                "price_per_unit": round(price_per_unit, 6)
                if price_per_unit is not None
                else None,
                "normalized_size": normalized_size,
                "display_per_unit": display_per_unit,
                "canonical_key": make_canonical_key(
                    r["generic_name"], r["parsed_brand"], size, unit
                ),
            }
        )

    # === SORTING FOR FLAT MODE ===
    if sort_by == "price_per_unit":
        products.sort(
            key=lambda x: (
                x["price_per_unit"]
                if x["price_per_unit"] is not None and x["available"]
                else float("inf")
            )
        )
    else:
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
                "sort_by": sort_by,
            },
        }

    # === GROUPING ===
    from collections import defaultdict

    groups_dict: defaultdict = defaultdict(
        lambda: {
            "canonical_key": "",
            "generic": term,
            "brand": None,
            "package_size": None,
            "unit": None,
            "normalized_size": None,
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
            norm_size = p.get("normalized_size")
        elif group == "size_only":
            key = make_canonical_key(None, None, p.get("package_size"), p.get("unit"))
            brand_val = None
            size_val = p.get("package_size")
            unit_val = p.get("unit")
            norm_size = p.get("normalized_size")
        else:  # brand_only
            key = make_canonical_key(None, p.get("parsed_brand"), None, None)
            brand_val = p.get("parsed_brand")
            size_val = None
            unit_val = None
            norm_size = None

        g = groups_dict[key]
        g.update(
            {
                "canonical_key": key,
                "brand": brand_val if group == "brand_size" else None,
                "package_size": size_val,
                "unit": unit_val,
                "normalized_size": norm_size,
            }
        )

        g["variants"].append(
            {
                "product_id": p["product_id"],
                "vtex_product_id": p.get("vtex_product_id"),
                "name": p["name"],
                "store": p["store"],
                "brand": p.get("brand"),
                "ean": p.get("ean"),
                "category": p.get("category"),
                "url": p.get("url"),
                "parsed_brand": p.get("parsed_brand"),
                "price": p["price"],
                "list_price": p["list_price"],
                "available": p["available"],
                "price_per_unit": p["price_per_unit"],
                "normalized_size": p["normalized_size"],
                "display_per_unit": p["display_per_unit"],
            }
        )

        if p.get("parsed_brand"):
            g["brands"].add(p["parsed_brand"])

    # Finalize groups
    grouped_list = []
    for g in groups_dict.values():
        valid_prices = [
            v["price"]
            for v in g["variants"]
            if v["price"] is not None and v["available"]
        ]
        g["price_stats"] = {
            "min": min(valid_prices) if valid_prices else None,
            "max": max(valid_prices) if valid_prices else None,
            "avg": round(sum(valid_prices) / len(valid_prices), 2)
            if valid_prices
            else None,
        }

        if group in ("size_only", "brand_only"):
            g["brand"] = sorted(list(g["brands"])) if g["brands"] else None

        del g["brands"]
        grouped_list.append(g)

    # Sort groups
    if sort_by == "price_per_unit":
        grouped_list.sort(
            key=lambda g: min(
                (
                    v["price_per_unit"]
                    for v in g["variants"]
                    if v["price_per_unit"] is not None and v["available"]
                ),
                default=float("inf"),
            )
        )
    else:
        grouped_list.sort(key=lambda g: g["price_stats"]["min"] or float("inf"))

    return {
        "generic": term,
        "group_mode": group,
        "sort_by": sort_by,
        "count": len(grouped_list),
        "groups": grouped_list,
        "_meta": {
            "fresh_cutoff": fresh_cutoff.isoformat(),
            "excluded_noise": exclude_noise,
            "store_filter": store,
        },
    }
