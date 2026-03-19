from fastapi import FastAPI, Query
from scraper.vtex import search, STORES, SORT_OPTIONS

app = FastAPI(
    title="monopop-intel",
    description="Market price intelligence for the Monopop ecosystem.",
)


@app.get("/search")
def search_products(
    q: str = Query(..., description="Search term"),
    store: str = Query("prezunic", description=f"Store name. Available: {list(STORES.keys())}"),
    sort: str = Query("relevance", description=f"Sort order. Available: {list(SORT_OPTIONS.keys())}"),
    page: int = Query(1, ge=1, description="Page number"),
):
    result = search(q, store=store, sort=sort, page=page)
    return result


@app.get("/stores")
def list_stores():
    return {"stores": list(STORES.keys())}


@app.get("/sort-options")
def list_sort_options():
    return {"sort_options": list(SORT_OPTIONS.keys())}