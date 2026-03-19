import httpx
import asyncio
from typing import Optional

ALL_STORE_FETCH_SIZE = 50  # busca fixa pra modo all

STORES = {
    "prezunic": "https://www.prezunic.com.br",
    "zonasul": "https://www.zonasul.com.br",
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
    item = product.get("items", [{}])[0]
    offer = item.get("sellers", [{}])[0].get("commertialOffer", {})

    return {
        "store": store,
        "product_id": product.get("productId"),
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
    params = {"ft": query, "_from": from_index, "_to": to_index}
    sort_value = SORT_OPTIONS.get(sort, "")
    if sort_value:
        params["O"] = sort_value

    response = await client.get(
        f"{base_url}/api/catalog_system/pub/products/search",
        params=params,
    )
    response.raise_for_status()

    # total vem no header: "0-9/47"
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
            results = await asyncio.gather(*[
                fetch_store(client, s, query, sort, 0, ALL_STORE_FETCH_SIZE - 1)
                for s in STORES
            ])

        all_products = []
        for products, _ in results:
            all_products.extend(products)

        # sort local após merge
        reverse = sort == "price_desc" or sort == "name_desc"
        key = "name" if "name" in sort else "price"
        if key == "price":
            all_products = [p for p in all_products if p["price"] is not None]
        all_products.sort(
            key=lambda x: (not x["available"], x[key] or 0, x["product_id"].zfill(10), x["store"]),
            reverse=reverse
        )
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


def search(query: str, store: str = "prezunic", sort: str = "relevance", page: int = 1) -> dict:
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