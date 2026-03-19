from fastapi import FastAPI, Query
from scraper.vtex import search, STORES

app = FastAPI(
    title="monopop-intel",
    description="Market price intelligence for the Monopop ecosystem.",
)


@app.get("/search")
def search_products(
    q: str = Query(..., description="Search term"),
    store: str = Query("prezunic", description=f"Store name. Available: {list(STORES.keys())}"),
):
    results = search(q, store=store)
    return {"query": q, "store": store, "count": len(results), "results": results}


@app.get("/stores")
def list_stores():
    return {"stores": list(STORES.keys())}