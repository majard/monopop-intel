from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, HTTPException

from cache import get_cached, init_db, make_query_key, purge_expired, set_cached
from scraper.vtex import SORT_OPTIONS, STORES, search_async


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    deleted = await purge_expired()
    if deleted:
        print(f"[cache] purged {deleted} expired rows on startup")
    yield


app = FastAPI(
    title="monopop-intel",
    description="Market price intelligence for the Monopop ecosystem.",
    lifespan=lifespan,
)


@app.get("/search")
async def search_products(
    q: str = Query(..., min_length=1, description="Search term"),
    store: str = Query("prezunic", description=f"Available: {list(STORES.keys()) + ['all']}"),
    sort: str = Query("relevance", description=f"Available: {list(SORT_OPTIONS.keys())}"),
    page: int = Query(1, ge=1, description="Page number"),
):
    # Runtime validation before cache lookup or scraper calls
    if not q or not q.strip():
        raise HTTPException(status_code=422, detail="Search term 'q' cannot be empty")
    
    valid_stores = list(STORES.keys()) + ["all"]
    if store not in valid_stores:
        raise HTTPException(status_code=422, detail=f"Invalid store '{store}'. Available: {valid_stores}")
    
    if sort not in SORT_OPTIONS:
        raise HTTPException(status_code=422, detail=f"Invalid sort '{sort}'. Available: {list(SORT_OPTIONS.keys())}")
    
    query_key = make_query_key(store, q, sort, page)

    cached = await get_cached(query_key)
    if cached:
        return {**cached["data"], "_cache": {"hit": True, "cached_at": cached["cached_at"], "age_seconds": cached["age_seconds"]}}

    result = await search_async(q, store=store, sort=sort, page=page)
    await set_cached(query_key, store, q, result)

    return {**result, "_cache": {"hit": False}}


@app.get("/stores")
def list_stores():
    return {"stores": list(STORES.keys()) + ["all"]}


@app.get("/sort-options")
def list_sort_options():
    return {"sort_options": list(SORT_OPTIONS.keys())}