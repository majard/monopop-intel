from fastapi import FastAPI, Query
from scraper.vtex import search_async, STORES, SORT_OPTIONS

app = FastAPI(
    title="monopop-intel",
    description="Market price intelligence for the Monopop ecosystem.",
)


@app.get("/search")
async def search_products(
    q: str = Query(..., description="Search term"),
    store: str = Query("prezunic", description=f"Available: {list(STORES.keys()) + ['all']}"),
    sort: str = Query("relevance", description=f"Available: {list(SORT_OPTIONS.keys())}"),
    page: int = Query(1, ge=1, description="Page number"),
):
    return await search_async(q, store=store, sort=sort, page=page)


@app.get("/stores")
def list_stores():
    return {"stores": list(STORES.keys()) + ["all"]}


@app.get("/sort-options")
def list_sort_options():
    return {"sort_options": list(SORT_OPTIONS.keys())}