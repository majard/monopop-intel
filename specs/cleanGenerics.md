**# Clean Generics & Parser Foundation**  

**Last updated:** 2026-03-27 

---

## Goal of v1

Prove the minimal viable loop:  
**raw VTEX name → parser → generic_name → cleaner results**  

Success = when searching "arroz", we see mostly actual rice (different brands/sizes) with dramatically less noise ("biscoito de arroz", "massa de arroz").

This directly enables the Monopop bridge (usable unit + package data for reference prices and per-unit normalization).

Existing `/history/*` and `/search` endpoints remain untouched.

---

## Core Decisions (locked)

- Extend existing `products` table only (no new tables in v1).
- Parser is the single source of truth for cleaning and classification.
- Manual backfill + visible report (same style as cron).
- Data freshness: latest price per product (if < 7 days old → fresh enough).
- Specific-first classification from allow_list.
- Start extremely simple on strip_noise and brand extraction; iterate based on real data.

---

## Schema Changes (v1)

Add these nullable columns to `products` (in `init_schema`):

```sql
ALTER TABLE products 
  ADD COLUMN generic_name TEXT,
  ADD COLUMN parsed_brand TEXT,
  ADD COLUMN package_size REAL,
  ADD COLUMN unit TEXT,                    -- 'g', 'ml', 'un'
  ADD COLUMN has_package_size BOOLEAN DEFAULT FALSE,
  ADD COLUMN is_noise BOOLEAN DEFAULT FALSE;
```

---

## Parser Module (`parsers/product_normalizer.py`)

**Core function (locked signature):**

```python
def clean_and_classify(
    name: str,
    term: str,
    allow_list_terms: list[str]   # ordered: most specific first
) -> dict:
```

**Return dict (locked):**

```json
{
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
```

**Helper functions (start minimal):**

- `strip_noise(name: str) -> str`  
  Very conservative: lowercase + unidecode + remove obvious numbers + units (e.g. "1kg", "500g", "1,5l").  
  **Do NOT** start with a long manual list of qualifiers. Keep the list tiny and expand only when real data shows clear need.

- `extract_package_size_and_unit(name: str) -> tuple[float|None, str|None]`  
  Conservative regex for common Brazilian formats. Normalize to atomic units. Fail gracefully to (None, None).  
  **This is high priority** — critical for Monopop unit bridge.

- `extract_brand(name: str) -> str|None`  
  Trivial extraction only in v1. If not obvious → return None. Do not block the pipeline.

- `compute_fuzzy_score(normalized: str, term: str) -> float`  
  Use `rapidfuzz.fuzz.token_set_ratio` (handles extra words well).  

- `is_salient_match(normalized: str, term: str) -> bool`  
  Cheap gate: term appears at start of normalized name **or** in first few tokens. This cuts most obvious noise ("massa de arroz", "biscoito de arroz") without heavy logic.

**Classification flow:**
1. Try allow_list_terms in order (specific first).
2. Strip noise → fuzzy_score ≥ 85 **AND** salient_match == True.
3. First match wins → set `generic_name`.
4. No good match → `generic_name = None`, `is_noise = True`.

---

## Implementation Order — Strict v1 Steps (do in this sequence)

**Step 1: Samples only (safety first)**  
Hardcode 10–20 real examples from the ARROZ JSON (and a few noisy ones).  
Run `clean_and_classify` and inspect output.  
Tune regex / salient check / threshold **before any DB work**.

**Step 2: Dry-run on real data**  
Run parser over 100–500 existing products.  
Print before/after + scores. No DB writes yet.  
Validate: does "arroz" look meaningfully cleaner?

**Step 3: Backfill script** (`backfill_clean_generics.py`)  
- Update columns in batches.  
- Print full report: parse %, fuzzy buckets, good/noisy examples, top unparsed sizes/brands.  

**Step 4: Simple endpoint** (`GET /generics/{term}`)  
Minimal response for v1:

```json
{
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
```

Use `WHERE generic_name = ? AND is_noise = false` (or similar).  
No stats, no min/median yet.

---

## Monopop Export Considerations (kept in mind, not in v1)

Parser gives us `unit` + `package_size` → easy mapping to `standardPackageSize` (chosen or simple mode later).  
Export (future) will use one generic per term, latest fresh prices, lowest-certain preference with median fallback.

---

## What is explicitly out of scope for v1

- Long manual strip lists  
- Complex brand fuzzy extraction  
- New tables or full T2/T3  
- Automatic cron parsing  
- Rich stats in /generics endpoint  
- Full certainty scoring  
- Monopop export endpoint  

---

## Next after v1 success

Once the loop is proven (cleaner "arroz" results + parser working on real data), we will expand:
- Better brand extraction
- Cross-store matching (generic + brand + size)
- Salient heuristics refinement
- Monopop JSON export
- etc.
