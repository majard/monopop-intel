import httpx
from typing import Optional

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


def search(
    query: str,
    store: str = "prezunic",
    sort: str = "relevance",
    page: int = 1,
) -> dict:
    base_url = STORES.get(store)
    if not base_url:
        raise ValueError(f"Unknown store: {store}. Available: {list(STORES.keys())}")

    from_index = (page - 1) * PAGE_SIZE
    to_index = from_index + PAGE_SIZE - 1

    params = {
        "ft": query,
        "_from": from_index,
        "_to": to_index,
    }

    sort_value = SORT_OPTIONS.get(sort, "")
    if sort_value:
        params["O"] = sort_value

    with httpx.Client(timeout=10) as client:
        response = client.get(
            f"{base_url}/api/catalog_system/pub/products/search",
            params=params,
        )
        response.raise_for_status()

    products = response.json()
    return {
        "store": store,
        "query": query,
        "sort": sort,
        "page": page,
        "page_size": PAGE_SIZE,
        "results": [parse_product(p, store) for p in products],
    }


if __name__ == "__main__":
    import json
    import sys

    query = sys.argv[1] if len(sys.argv) > 1 else "arroz"
    store = sys.argv[2] if len(sys.argv) > 2 else "prezunic"
    sort = sys.argv[3] if len(sys.argv) > 3 else "relevance"
    page = int(sys.argv[4]) if len(sys.argv) > 4 else 1

    result = search(query, store=store, sort=sort, page=page)
    print(json.dumps(result, indent=2, ensure_ascii=False))