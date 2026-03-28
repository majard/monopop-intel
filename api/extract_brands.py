import asyncio
import json
from pathlib import Path
from db import get_pool

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
    
    brands = [{"brand": r["brand"], "freq": r["freq"], "canonical": None, "active": True} 
              for r in rows]
    
    path = Path("parsers/brands.json")
    with open(path, "w") as f:
        json.dump({"version": "0.1", "brands": brands}, f, indent=2, ensure_ascii=False)
    
    print(f"Exported {len(brands)} brands to {path}")

if __name__ == "__main__":
    asyncio.run(main())