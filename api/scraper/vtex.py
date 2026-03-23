import httpx
import asyncio
from urllib.parse import quote

ALL_STORE_FETCH_SIZE = 50  # busca fixa pra modo all

STORES = {
    "prezunic": "https://www.prezunic.com.br",
    "zonasul": "https://www.zonasul.com.br",
    "hortifruti": "https://www.hortifruti.com.br",
}

SORT_OPTIONS = {
    "relevance": "",
    "price_asc": "OrderByPriceASC",
    "price_desc": "OrderByPriceDESC",
    "name_asc": "OrderByNameASC",
    "name_desc": "OrderByNameDESC",
}

PAGE_SIZE = 10


def parse_product(product: dict, store: str) -> dict:
    # Guard against empty items list
    items = product.get("items", [])
    if not isinstance(items, list) or len(items) == 0:
        item = {}
    else:
        item = items[0]
    
    # Guard against empty sellers list
    sellers = item.get("sellers", [])
    if not isinstance(sellers, list) or len(sellers) == 0:
        offer = {}
    else:
        offer = sellers[0].get("commertialOffer", {})

    return {
        "store": store,
        "product_id": str(product.get("productId", "")),
        "name": product.get("productName"),
        "brand": product.get("brand"),
        "ean": item.get("ean"),
        "price": offer.get("Price"),
        "list_price": offer.get("ListPrice"),
        "available": offer.get("IsAvailable", False),
        "url": product.get("link"),
    }


async def fetch_store(
    client: httpx.AsyncClient,
    store: str,
    query: str,
    sort: str,
    from_index: int,
    to_index: int,
) -> tuple[list[dict], int]:
    base_url = STORES[store]
    sort_value = SORT_OPTIONS.get(sort, "")

    param_str = f"_from={from_index}&_to={to_index}"
    if sort_value:
        param_str += f"&O={sort_value}"

    # httpx re-encodes %20 as + when using params dict or httpx.URL(),
    # and VTEX rejects + in the ft param with "Bad Request! Scripts are not allowed!"
    # URL must be built manually to preserve percent-encoding.
    url = f"{base_url}/api/catalog_system/pub/products/search?ft={quote(query)}&{param_str}"
    response = await client.get(url)
    response.raise_for_status()

    resources = response.headers.get("resources", "")
    total = int(resources.split("/")[1]) if "/" in resources else 0

    products = [parse_product(p, store) for p in response.json()]
    return products, total


async def search_async(
    query: str,
    store: str = "prezunic",
    sort: str = "relevance",
    page: int = 1,
) -> dict:
    if store == "all":
        # busca page * PAGE_SIZE de cada loja pra garantir merge correto
        async with httpx.AsyncClient(timeout=10) as client:
            results = await asyncio.gather(
                *[
                    fetch_store(client, s, query, sort, 0, ALL_STORE_FETCH_SIZE - 1)
                    for s in STORES
                ]
            )

        all_products = []
        for products, _ in results:
            all_products.extend(products)

        # sort local após merge
        # Derive primary sort key only when sort explicitly contains "price" or "name"
        if "price" in sort:
            key = "price"
        elif "name" in sort:
            key = "name"
        else:
            key = None
        
        # Only filter out products with None price when sort explicitly requests price ordering
        if key == "price":
            all_products = [p for p in all_products if p["price"] is not None]
        
        # First sort by primary key (if any)
        if key is not None:
            reverse = sort.endswith("_desc")
            if key == "name":
                all_products.sort(
                    key=lambda x: (
                        (x.get("name") or "").casefold(),
                        x["product_id"].zfill(10),
                        x["store"],
                    ),
                    reverse=reverse,
                )
            else:
                all_products.sort(
                    key=lambda x: (
                        x[key] or 0,
                        x["product_id"].zfill(10),
                        x["store"],
                    ),
                    reverse=reverse,
                )
        
        # Then stable sort to place available items first (availability sorting separate)
        all_products.sort(key=lambda x: not x["available"])
        start = (page - 1) * PAGE_SIZE
        end = start + PAGE_SIZE
        page_results = all_products[start:end]

        return {
            "store": "all",
            "query": query,
            "sort": sort,
            "page": page,
            "page_size": PAGE_SIZE,
            "total": None,  # não calculável com precisão no modo all
            "has_more": len(page_results) == PAGE_SIZE,
            "results": page_results,
        }

    else:
        from_index = (page - 1) * PAGE_SIZE
        to_index = from_index + PAGE_SIZE - 1

        async with httpx.AsyncClient(timeout=10) as client:
            products, total = await fetch_store(
                client, store, query, sort, from_index, to_index
            )

        return {
            "store": store,
            "query": query,
            "sort": sort,
            "page": page,
            "page_size": PAGE_SIZE,
            "total": total,
            "has_more": to_index < total - 1,
            "results": products,
        }


def search(
    query: str, store: str = "prezunic", sort: str = "relevance", page: int = 1
) -> dict:
    return asyncio.run(search_async(query, store=store, sort=sort, page=page))


if __name__ == "__main__":
    import json
    import sys

    query = sys.argv[1] if len(sys.argv) > 1 else "arroz"
    store = sys.argv[2] if len(sys.argv) > 2 else "prezunic"
    sort = sys.argv[3] if len(sys.argv) > 3 else "relevance"
    page = int(sys.argv[4]) if len(sys.argv) > 4 else 1

    result = search(query, store=store, sort=sort, page=page)
    print(json.dumps(result, indent=2, ensure_ascii=False))
