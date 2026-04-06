import asyncio
import json
from pathlib import Path
from db import get_pool


def load_existing_brands():
    """Load existing brands data if present"""
    brands_path = Path(__file__).parent / "parsers" / "brands.json"
    if brands_path.exists():
        with open(brands_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {brand["brand"]: brand for brand in data.get("brands", [])}
    return {}


async def main():
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT brand, COUNT(*) as freq 
            FROM products 
            WHERE brand IS NOT NULL AND brand != ''
            GROUP BY brand 
            ORDER BY freq DESC
        """)
    
    # Load existing brands to preserve curated metadata
    existing_brands = load_existing_brands()
    
    brands = []
    for r in rows:
        brand_name = r["brand"]
        existing_brand = existing_brands.get(brand_name, {})
        
        brands.append({
            "brand": brand_name,
            "freq": r["freq"],
            "canonical": existing_brand.get("canonical", None),  # Preserve existing canonical or default to None
            "active": existing_brand.get("active", True)         # Preserve existing active or default to True
        })
    
    path = Path(__file__).parent / "parsers" / "brands.json"
    
    # FIXED: proper UTF-8 + ensure_ascii=False to keep accents
    with open(path, "w", encoding="utf-8") as f:
        json.dump(
            {"version": "0.1", "brands": brands}, 
            f, 
            indent=2, 
            ensure_ascii=False   # This is the important part
        )
    
    print(f"Exported {len(brands)} brands to {path}")


if __name__ == "__main__":
    asyncio.run(main())