import json
import random
import asyncio
import argparse
from pathlib import Path
from typing import List, Dict

from db import get_pool
from parsers.product_normalizer import clean_and_classify


async def get_random_products_for_term(term: str, limit: int = 10) -> List[Dict]:
    """Fetch random products for a given term (read-only)."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT DISTINCT ON (p.id)
                p.id, p.name, p.brand, p.store, pp.term
            FROM products p
            JOIN price_points pp ON pp.product_id = p.id
            WHERE pp.term = $1
            ORDER BY p.id, pp.scraped_at DESC
            LIMIT $2
            """,
            term,
            limit
        )
    return [dict(r) for r in rows]


async def run_dry_run(
    num_terms: int = 3,
    products_per_term: int = 10,
    seed: int | None = None,
    force_term: str | None = None,
    verbose: int = 4,
    min_products: int = 5
):
    if seed is not None:
        random.seed(seed)

    allow_list_path = Path("allow_list.json")
    with open(allow_list_path) as f:
        data = json.load(f)

    all_terms = [entry["term"] for entry in data.get("terms", [])]
    allow_list_for_parser = all_terms.copy()

    if force_term and force_term in all_terms:
        selected_terms = [force_term]
    else:
        selected_terms = random.sample(all_terms, min(num_terms, len(all_terms)))

    print(f"=== Dry Run: {len(selected_terms)} terms × up to {products_per_term} products (seed={seed}) ===\n")

    stats = {"total_products": 0, "noise_count": 0, "with_size": 0, "by_term": {}}

    for term in selected_terms:
        products = await get_random_products_for_term(term, products_per_term)
        if len(products) < min_products and not force_term:
            print(f"Skipping '{term}' — only {len(products)} products found (min {min_products})")
            continue

        print(f"Term: '{term}' ({len(products)} products)")
        term_stats = {"total": len(products), "noise": 0, "with_size": 0, "good": 0}

        shown = 0
        for prod in products:
            result = clean_and_classify(prod["name"], term, allow_list_for_parser)
            is_noise = result["is_noise"]
            has_size = result["package_size"] is not None

            if is_noise:
                term_stats["noise"] += 1
            if has_size:
                term_stats["with_size"] += 1
            if not is_noise:
                term_stats["good"] += 1

            # Show examples (always show first few + controlled by verbose)
            if shown < verbose or shown < 4:
                print(f"  → {prod['name'][:85]:<85} | Generic: {result['generic_name'] or 'None':<12} | "
                      f"Noise: {is_noise} | Size: {result.get('package_size')} {result.get('unit') or ''} | "
                      f"Brand: {result['parsed_brand'] or 'None'}")
                shown += 1

        stats["total_products"] += term_stats["total"]
        stats["noise_count"] += term_stats["noise"]
        stats["with_size"] += term_stats["with_size"]
        stats["by_term"][term] = term_stats

        noise_rate = (term_stats["noise"] / term_stats["total"]) * 100 if term_stats["total"] > 0 else 0
        parse_rate = (term_stats["with_size"] / term_stats["total"]) * 100 if term_stats["total"] > 0 else 0
        print(f"  Noise rate: {noise_rate:.1f}% | Parse success: {parse_rate:.1f}% | Good: {term_stats['good']}\n")

    # Overall summary
    overall_noise = (stats["noise_count"] / stats["total_products"]) * 100 if stats["total_products"] > 0 else 0
    overall_parse = (stats["with_size"] / stats["total_products"]) * 100 if stats["total_products"] > 0 else 0

    print("=== DRY RUN SUMMARY ===")
    print(f"Terms tested: {len(selected_terms)}")
    print(f"Total products: {stats['total_products']}")
    print(f"Overall noise rate: {overall_noise:.1f}%")
    print(f"Overall package_size parse rate: {overall_parse:.1f}%")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parser dry-run on real data")
    parser.add_argument("--num-terms", type=int, default=3, help="Number of random terms to test")
    parser.add_argument("--products", type=int, default=10, help="Max products per term")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for reproducibility")
    parser.add_argument("--term", type=str, default=None, help="Force a specific term")
    parser.add_argument("--verbose", type=int, default=4, help="Number of examples to show per term")
    parser.add_argument("--min-products", type=int, default=5, help="Skip terms with fewer products")
    args = parser.parse_args()

    asyncio.run(run_dry_run(
        num_terms=args.num_terms,
        products_per_term=args.products,
        seed=args.seed,
        force_term=args.term,
        verbose=args.verbose,
        min_products=args.min_products
    ))