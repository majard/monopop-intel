#!/usr/bin/env python3
"""
Manual backfill for clean generics v1 - with detailed report.
"""

import asyncio
import argparse
import json
from pathlib import Path
from datetime import date, timedelta
from collections import Counter

from db import get_pool, init_schema
from parsers.product_normalizer import clean_and_classify


async def backfill_clean_generics(force: bool = False, batch_size: int = 500, limit: int | None = None):
    await init_schema()
    pool = await get_pool()

    async with pool.acquire() as conn:
        total = await conn.fetchval("SELECT COUNT(*) FROM products")

        where = "WHERE generic_name IS NULL" if not force else ""
        limit_clause = f" LIMIT {limit}" if limit else ""

        rows = await conn.fetch(f"""
            SELECT 
                p.id,
                p.name,
                p.brand as db_brand,
                p.store
            FROM products p
            {where}
            ORDER BY p.id
            {limit_clause}
        """)

    print(f"[backfill] Starting: {len(rows)} products to process (total in DB: {total})")

    updated = 0
    noise_count = 0
    size_count = 0
    fuzzy_scores = []
    generic_counter = Counter()
    noise_examples = []
    good_examples = []
    unparsed_size_examples = []

    allow_list_path = Path(__file__).parent / "allow_list.json"
    with open(allow_list_path, encoding="utf-8") as f:
        allow_list_terms = [entry["term"] for entry in json.load(f)["terms"]]

    async with pool.acquire() as conn:
        for i, row in enumerate(rows, 1):
            try:
                result = clean_and_classify(
                    name=row["name"],
                    term=row["name"],
                    allow_list_terms=allow_list_terms,
                    db_brand=row["db_brand"]
                )

                await conn.execute("""
                    UPDATE products 
                    SET generic_name = $1,
                        parsed_brand = $2,
                        package_size = $3,
                        unit = $4,
                        is_noise = $5
                    WHERE id = $6
                """,
                    result["generic_name"],
                    result["parsed_brand"],
                    result["package_size"],
                    result["unit"],
                    result["is_noise"],
                    row["id"]
                )

                updated += 1
                if result.get("is_noise"):
                    noise_count += 1
                    if len(noise_examples) < 5:
                        noise_examples.append(row["name"])
                else:
                    if len(good_examples) < 5:
                        good_examples.append(f"{row['name']} → {result.get('generic_name')}")

                if result.get("package_size") is not None:
                    size_count += 1
                else:
                    if len(unparsed_size_examples) < 5 and "g" in row["name"].lower():
                        unparsed_size_examples.append(row["name"])

                fuzzy_scores.append(result.get("fuzzy_score", 0))
                if result.get("generic_name"):
                    generic_counter[result["generic_name"]] += 1

                if i % batch_size == 0 or i == len(rows):
                    print(f"[progress] Processed {i}/{len(rows)} products...")

            except Exception as e:
                print(f"[error] Failed on product {row['id']}: {e}")

    # Rich report
    print("\n" + "="*60)
    print("BACKFILL REPORT - CLEAN GENERICS v1")
    print("="*60)
    print(f"Total processed          : {updated:,}")
    if updated > 0:
        print(f"Generic name set         : {updated - noise_count:,} ({(updated - noise_count)/updated*100:.1f}%)")
        print(f"Noise flagged            : {noise_count:,} ({noise_count/updated*100:.1f}%)")
        print(f"With package size        : {size_count:,} ({size_count/updated*100:.1f}%)")
        if fuzzy_scores:
            print(f"Average fuzzy score      : {sum(fuzzy_scores)/len(fuzzy_scores):.1f}")

    print(f"\nTop generics (by count):")
    for gen, count in generic_counter.most_common(10):
        print(f"  • {gen}: {count:,}")

    print(f"\nGood examples (non-noise):")
    for ex in good_examples:
        print(f"  ✓ {ex}")

    print(f"\nNoise examples:")
    for ex in noise_examples:
        print(f"  ✗ {ex}")

    print(f"\nUnparsed sizes (containing 'g'):")
    for ex in unparsed_size_examples:
        print(f"  ? {ex}")

    print(f"\nBackfill completed at {date.today()}")
    print("="*60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Clean Generics Backfill v1 - Detailed Report")
    parser.add_argument("--force", action="store_true", help="Reprocess all rows")
    parser.add_argument("--batch", type=int, default=500, help="Batch size")
    parser.add_argument("--limit", type=int, help="Limit number of products (for testing)")
    args = parser.parse_args()

    asyncio.run(backfill_clean_generics(
        force=args.force,
        batch_size=args.batch,
        limit=args.limit
    ))