import httpx
from typing import Optional


STORES = {
    "prezunic": "https://www.prezunic.com.br",
    "zonasul": "https://www.zonasul.com.br",
}


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


def search(query: str, store: str = "prezunic") -> list[dict]:
    base_url = STORES.get(store)
    if not base_url:
        raise ValueError(f"Unknown store: {store}. Available: {list(STORES.keys())}")

    url = f"{base_url}/api/catalog_system/pub/products/search"
    params = {"ft": query, "_from": 0, "_to": 9}

    with httpx.Client(timeout=10) as client:
        response = client.get(url, params=params)
        response.raise_for_status()

    products = response.json()
    return [parse_product(p, store) for p in products]


if __name__ == "__main__":
    import json
    import sys

    query = sys.argv[1] if len(sys.argv) > 1 else "arroz"
    store = sys.argv[2] if len(sys.argv) > 2 else "prezunic"
    results = search(query, store=store)
    print(json.dumps(results, indent=2, ensure_ascii=False))