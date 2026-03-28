#Clean Generics & Parser Foundation
Master Execution Spec. This document is the single source of truth for the feature. Update only on explicit decision.
Last updated: 2026-03-28

Overview
Mintel provides market price intelligence for the Monopop ecosystem. Current search and history endpoints return raw VTEX results that mix relevant products with noise. For a term such as "arroz", results include legitimate rice items alongside "biscoito de arroz" and "massa de arroz".
This spec defines the minimal changes needed to produce cleaner results grouped by generic term while preserving all existing behavior. The parsed data will support Monopop’s unit system (v1.7.0) by supplying reliable unit and package_size for reference prices, per-unit normalization, and import.

Goals for v1

Reduce obvious noise in results for allow-list terms.
Populate parsed fields in the existing products table.
Deliver a simple new endpoint that demonstrates improved relevance.
Keep the parser extensible for future cross-store matching, brand handling, and Monopop export.
Maintain backward compatibility for all existing endpoints and legacy products.


Scope for v1
In scope

Add nullable columns to the products table.
Implement a parser with small, single-responsibility functions.
Manual backfill script with visible report.
New minimal /generics/{term} endpoint.
Use latest price per product (observations < 7 days old are considered fresh).

Out of scope for v1

New tables.
Automatic parsing during cron runs.
Complex brand fuzzy matching or full cross-store variant logic.
Rich statistics or advanced certainty scoring in the endpoint.
Monopop export endpoint.


Schema Changes
Add the following nullable columns to the products table (in db.py init_schema):
SQLALTER TABLE products 
  ADD COLUMN generic_name TEXT,
  ADD COLUMN parsed_brand TEXT,
  ADD COLUMN package_size REAL,
  ADD COLUMN unit TEXT,                    -- 'g', 'ml', 'un'
  ADD COLUMN has_package_size BOOLEAN DEFAULT FALSE,
  ADD COLUMN is_noise BOOLEAN DEFAULT FALSE;
No indexes are added in v1. Note: has_package_size may be redundant with package_size IS NOT NULL; keep for v1 only if needed for query patterns.

Parser (parsers/product_normalizer.py)
The parser is the single source of truth for name cleaning and classification.
Core function
Pythondef clean_and_classify(
    name: str,
    term: str,
    allow_list_terms: list[str],   # ordered most-specific first
    db_brand: Optional[str] = None
) -> dict:
Return value
JSON{
  "generic_name": "arroz",
  "normalized_name": "arroz palmares original",
  "fuzzy_score": 92.3,
  "parsed_brand": "Palmares",
  "package_size": 1000.0,
  "unit": "g",
  "is_noise": false,
  "confidence_flags": {
    "has_size": true,
    "good_fuzzy": true,
    "salient_match": true
  }
}
Classification rules

Iterate allow_list_terms in order (specific first).
Apply strip_noise then check for salient match (term appears early in the normalized name).
Fuzzy score (rapidfuzz.token_set_ratio) is recorded for reporting but is not a hard gate.
If no salient match is found after trying terms, set generic_name = None and is_noise = True.
Strict categorization: Flavor/scent variants match their base product category, not the flavor term (e.g. "Refrigerante Limão" → generic refrigerante; "Detergente Capim Limão" → generic detergente).

Helper functions

strip_noise(name: str) -> str
Lowercase + unidecode + remove obvious numbers and units. Start with a small domain-specific list of common qualifiers. Expand only based on real data.
extract_package_size_and_unit(name: str) -> tuple[float|None, str|None]
Conservative regex for Brazilian supermarket formats. Handle Brazilian decimal commas ("1,5kg"). Normalize to atomic units. Handle weight-variable Hortifruti items gracefully (null if no explicit size).
extract_brand(name: str, generic_name: Optional[str], db_brand: Optional[str] = None) -> str|None
Priority: DB brand (if reliable and appears in name) → known brands from JSON → positional heuristics (brand usually right after generic). Skip "Hortifruti" when meaningless.
is_salient_match(normalized: str, term: str) -> bool
Strong "generic at the beginning" rule + support for multi-word terms.
is_ingredient_modifier(product: str, term: str) -> bool
Distinguish "X de TERM" where TERM is ingredient (noise for TERM) vs "TERM de X" where TERM is the product.


Backfill Script (backfill_clean_generics.py)

Idempotent by default: skip rows where generic_name is already set (add --force flag to reprocess).
Process in batches.
Join against latest fresh price_points (< 7 days old) for price selection.
Produce a human-readable report including:
Percentage of rows with generic_name set.
Percentage with successful package_size/unit parsing.
Fuzzy score distribution.
Before/after examples (good and noisy).
Top suspected noise items.
Top unparsed sizes and brands.


Run the script manually, similar to cron.py.

New Endpoint
GET /generics/{term}
Optional parameters: store, exclude_noise=true (default).
Minimal response shape for v1
JSON{
  "generic": "arroz",
  "products": [
    {
      "name": "Arroz Palmares Original 1Kg",
      "store": "prezunic",
      "price": 3.99,
      "package_size": 1000,
      "unit": "g",
      "parsed_brand": "Palmares"
    }
  ]
}
Implementation uses the new generic_name and is_noise columns for filtering.

Implementation Order

Exploration (10 minutes) — Query real name distribution.
Samples — Hardcode representative examples. Test and tune.
Dry run — Run parser over 100–500 real products. Print results only.
Partial backfill — Process ~500 products and generate report.
Full backfill + endpoint — Complete backfill and add the new endpoint.
Validation — Manually confirm "arroz" results are meaningfully cleaner.


Future Phases & Guiding Principles
The v1 parser and parsed fields are designed as a foundation for the complete feature. Subsequent work will build directly on them without breaking changes.
Overall vision (guiding star)

Clean generics first (reduce noise, improve relevance).
Optional drill-down by parsed_brand and package size.
Cross-store comparison of the “same” item using generic_name + parsed_brand + package_size + unit (EAN as supplementary signal; downweight for Hortifruti where unreliable).
Monopop export: one entry per generic term (Monopop does not support brands yet).
Prices: prefer lowest “certain” price per store (good fuzzy + has_package_size + multi-store presence), fallback to median.
Use latest fresh price (< 7 days old).
standardPackageSize: use chosen package_size when user selects a specific variant; otherwise use mode (most common size) or simple default.
JSON structure maps to Monopop models: Product (with unit and standardPackageSize), product_store_prices, product_base_prices.
Legacy products without unit remain untouched.

Key design principles applied

No new tables in v1 (extend products only).
Parser functions are small and independent for easy future extension.
is_noise is a flag, not deletion, to allow inspection and tuning.
generic_name column avoids heavy repeated joins or on-the-fly derivation.
Parsing remains manual for v1.
All future phases reuse the same parser output and parsed columns.

Deferred items (post-v1)

Full cross-store matching and variant logic.
Advanced certainty scoring beyond basic flags.
Monopop export endpoint and JSON generation.
Rich UI statistics or hierarchy implementation.