import asyncio
import argparse
import json
from pathlib import Path
from datetime import datetime
from collections import Counter

from db import get_pool, init_schema
from parsers.product_normalizer import clean_and_classify


async def backfill_clean_generics(force: bool = False, batch_size: int = 5000, limit: int | None = None):
    start_time = datetime.now()
    await init_schema()
    pool = await get_pool()

    # Load allow_list once
    allow_list_path = Path(__file__).parent / "allow_list.json"
    with open(allow_list_path, encoding="utf-8") as f:
        allow_list_terms = [entry["term"] for entry in json.load(f)["terms"]]

    async with pool.acquire() as conn:
        total = await conn.fetchval("SELECT COUNT(*) FROM products")

        where = "WHERE generic_name IS NULL" if not force else ""
        limit_clause = f" LIMIT {limit}" if limit else ""

        rows = await conn.fetch(f"""
            SELECT id, name, brand as db_brand
            FROM products
            {where}
            ORDER BY id
            {limit_clause}
        """)

    print(f"[backfill] Starting: {len(rows)} products to process (total in DB: {total})")

    updated = 0
    noise_count = 0
    size_count = 0
    fuzzy_scores = []
    generic_counter = Counter()
    good_examples = []
    noise_examples = []
    unparsed_size_examples = []

    async with pool.acquire() as conn:
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            updates = []

            for row in batch:
                try:
                    result = clean_and_classify(
                        name=row["name"],
                        term=None,                    # backfill mode
                        allow_list_terms=allow_list_terms,
                        db_brand=row["db_brand"]
                    )

                    updates.append((
                        result["generic_name"],
                        result["parsed_brand"],
                        result["package_size"],
                        result["unit"],
                        result["is_noise"],
                        row["id"]
                    ))

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
                    elif any(c in row["name"].lower() for c in "gmlk"):
                        if len(unparsed_size_examples) < 5:
                            unparsed_size_examples.append(row["name"])

                    fuzzy_scores.append(result.get("fuzzy_score", 0))
                    if result.get("generic_name"):
                        generic_counter[result["generic_name"]] += 1

                except Exception as e:
                    print(f"[error] Failed on product {row['id']}: {e}")

            # Bulk update for this batch
            if updates:
                await conn.executemany("""
                    UPDATE products 
                    SET generic_name = $1,
                        parsed_brand = $2,
                        package_size = $3,
                        unit = $4,
                        is_noise = $5
                    WHERE id = $6
                """, updates)

            print(f"[progress] Processed {min(i + batch_size, len(rows))}/{len(rows)} products...")

    duration = datetime.now() - start_time

    # Rich report
    print("\n" + "="*80)
    print("BACKFILL REPORT - CLEAN GENERICS v1")
    print("="*80)
    print(f"Total processed          : {updated:,}")
    if updated > 0:
        print(f"Generic name set         : {updated - noise_count:,} ({(updated - noise_count)/updated*100:.1f}%)")
        print(f"Noise flagged            : {noise_count:,} ({noise_count/updated*100:.1f}%)")
        print(f"With package size        : {size_count:,} ({size_count/updated*100:.1f}%)")
        if fuzzy_scores:
            print(f"Average fuzzy score      : {sum(fuzzy_scores)/len(fuzzy_scores):.1f}")

    print(f"\nDuration                 : {duration}")
    print(f"Products per second      : {updated / duration.total_seconds():.1f}")
    print(f"Batch size used          : {batch_size}")

    print(f"\nTop 10 generics:")
    for gen, count in generic_counter.most_common(10):
        print(f"  • {gen}: {count:,}")

    print(f"\nGood examples (non-noise):")
    for ex in good_examples:
        print(f"  ✓ {ex}")

    print(f"\nNoise examples:")
    for ex in noise_examples:
        print(f"  ✗ {ex}")

    print(f"\nUnparsed sizes (containing g/ml/k):")
    for ex in unparsed_size_examples:
        print(f"  ? {ex}")

    print(f"\nBackfill completed at {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("="*80)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fast + Rich Clean Generics Backfill v1")
    parser.add_argument("--force", action="store_true", help="Reprocess all rows")
    parser.add_argument("--batch", type=int, default=5000, help="Batch size")
    parser.add_argument("--limit", type=int, help="Limit number of products (for testing)")
    args = parser.parse_args()

    asyncio.run(backfill_clean_generics(
        force=args.force,
        batch_size=args.batch,
        limit=args.limit
    ))