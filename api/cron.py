import asyncio
import json
import unicodedata
import argparse
from pathlib import Path
from datetime import date

from db import close_pool, get_pool, init_schema
from history_writer import insert_price_points, log_scrape, upsert_products
from scraper.vtex import STORES, fetch_all

# Config: 10 concurrent requests allowed PER STORE
CONCURRENCY_PER_STORE = 10


def normalize_term(term: str) -> str:
    return (
        unicodedata.normalize("NFKD", term)
        .encode("ascii", "ignore")
        .decode()
        .lower()
        .strip()
    )


async def scrape_term(entry: dict, store: str, today: date) -> None:
    term = entry["term"]
    max_results = entry.get("max_results", 50)
    normalized = normalize_term(term)

    try:
        products = await fetch_all(normalized, store=store, max_results=max_results)

        if not products:
            await log_scrape(term, store, "ok")
            print(f"[ok] {term} x {store} — 0 products")
            return

        id_map = await upsert_products(products)
        await insert_price_points(products, id_map, term, today)
        await log_scrape(term, store, "ok")
        print(f"[ok] {term} × {store} — {len(products)} products")

    except Exception as e:
        await log_scrape(term, store, "failed", str(e))
        print(f"[fail] {term} × {store} — {e}")


async def run_cron(retry_mode: bool = False, limit: int | None = None) -> None:
    today = date.today() 
    total_concurrency = len(STORES) * CONCURRENCY_PER_STORE
    await get_pool(max_concurrency=total_concurrency)
    await init_schema()

    allow_list_path = Path(__file__).parent / "allow_list.json"
    with open(allow_list_path) as f:
        data = json.load(f)

    entries = data["terms"]
    
    if limit:
        original_count = len(entries)
        entries = entries[:limit]
        print(f"[cron] Limited to {len(entries)}/{original_count} terms")
    
    failed_pairs: set = set()

    if retry_mode:
        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT DISTINCT term, store FROM scrape_log s1
                WHERE status = 'failed'
                AND scraped_at > NOW() - INTERVAL '24 hours'
                AND NOT EXISTS (
                    SELECT 1 FROM scrape_log s2
                    WHERE s2.term = s1.term
                    AND s2.store = s1.store
                    AND s2.status = 'ok'
                    AND s2.scraped_at > s1.scraped_at
                )
            """)
        failed_pairs = {(r["term"], r["store"]) for r in rows}
        print(f"[retry] {len(failed_pairs)} failed term × store pairs")
    else:
        print(f"[cron] {len(entries)} terms × {len(STORES)} stores")

    store_semaphores = {
        store: asyncio.Semaphore(CONCURRENCY_PER_STORE) for store in STORES
    }

    async def scrape_with_semaphore(entry: dict, store: str) -> None:
        async with store_semaphores[store]:
            await scrape_term(entry, store, today)

    tasks = []
    for entry in entries:
        for store in STORES:
            if retry_mode and (entry["term"], store) not in failed_pairs:
                continue
            tasks.append(scrape_with_semaphore(entry, store))

    if tasks:
        await asyncio.gather(*tasks)

    print(f"[done] Scrape cycle complete. Total tasks: {len(tasks)}")
    await close_pool()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Price scraping cron")
    parser.add_argument("--retry", action="store_true", help="Retry failed scrapes")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of terms")
    args = parser.parse_args()
    
    asyncio.run(run_cron(retry_mode=args.retry, limit=args.limit))