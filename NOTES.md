# NOTES — Data Layer Design

Engineering notes for the monopop-intel data layer.
Not a spec — a record of reasoning. Things marked **open** are unresolved.
Update as decisions get made.

---

## Context

The stack is a FastAPI backend with parallel async scraping via httpx + asyncio,
hitting VTEX public APIs for Prezunic, Zona Sul, and Hortifruti. Results are served
to a Next.js 15 frontend with a SQLite reactive cache layer and a PostgreSQL
price history layer.

---

## Layer 1 — Reactive Cache

### Purpose
Sits between the `/search` endpoint and the VTEX scraper. Eliminates redundant
API calls for repeated searches; provides a fallback when VTEX fails.

### Schema (SQLite, aiosqlite)
```
price_cache(
  query_key   TEXT PRIMARY KEY,   -- SHA-256 of normalized key string
  store       TEXT,
  query_text  TEXT,               -- human-readable, for debugging
  result_json TEXT,               -- full scraper response blob
  cached_at   REAL                -- Unix timestamp
)
```

Blob storage — the full JSON response is stored as-is. Fast to read and write,
no assembly required. The tradeoff is opacity: you can't query inside the blob.
That's acceptable for a cache whose only job is "return this fast."

### TTL and fallback behavior
**TTL: 4 hours.** Rationale: supermarket prices don't change intraday, but a 12h+
TTL risks serving a full day of stale prices depending on when the user searches
relative to when prices were last updated. 4h is conservative enough to be safe,
loose enough to absorb normal traffic without hammering VTEX.

**Fallback behavior (not yet implemented):** When a cache row is stale,
attempt a live VTEX call first. If VTEX succeeds, update the row and return fresh.
If VTEX fails (timeout, empty result, error), return the stale row anyway with a
`stale: true` flag. The cache is a safety net, not just a performance optimization.
This means rows are never deleted solely because they're old — only replaced by
a successful fresh scrape.

**Current behavior (v1):** Passive TTL only. Stale rows are deleted on read.
No fallback to stale data on VTEX failure. This is good enough for MVP.
The fallback behavior is the meaningful v2 upgrade.

### Cache key design
Key is `SHA-256(store:normalized_query:sort:page)`. All four parameters are
included because `prezunic:arroz:price_asc:1` and `prezunic:arroz:relevance:1`
are different result sets.

Query normalization: lowercase, strip accents, strip non-alphanumeric, collapse
whitespace. Rewritten in Python from the similarity utils in the Monopop app.

The key is a hash (not the raw string) for consistent length and to avoid
edge cases with special characters in SQLite primary keys.

### Allow-list
~210 canonical product terms in `api/allow_list.json`, version-controlled.
The allow-list is a **reject filter**, not a normalization target. A query
that matches "arroz" is cached under its normalized form ("arroz tio joao",
"arroz tipo 1"), not collapsed to "arroz". Brand and variant intent is preserved.
The allow-list only answers: "is this query cacheable at all?"

Per-term `max_results` field controls how many products the cron fetches
for that term. Defaults to 50. High-volume terms (leite, frango, cerveja)
are set higher.

**Open: allow-list wiring.** The allow-list exists and drives the cron but
is not yet wired into the reactive cache. Unbounded key growth (cache flooding)
is still possible from the search endpoint. Wiring the fuzzy filter is the
next cache upgrade.

**Open: threshold value.** Monopop uses 0.55 for product matching. The
allow-list use case may want a lower threshold since we're pattern-matching
against broad category terms, not specific products.

**Open: store-term affinity.** Some terms are only meaningful for specific
stores. The allow-list could carry metadata indicating which stores to query
per term. Low priority.

---

## Layer 2 — Price History

### Purpose
A persistent record of prices over time. Feeds future analytics, inflation
tracking, and the cross-reference engine (top-down vs bottom-up prices).
Not a cache — rows are never invalidated, only appended.

Full design in `specs/priceHistory.md`.

### Schema (PostgreSQL on Railway)
Normalized — each price observation is its own row.

```sql
products(id, vtex_product_id, store, name, brand, ean,
         category, category_path, measurement_unit, unit_multiplier, url)

price_points(id, product_id, term, price, list_price, available, scraped_at)

scrape_log(id, term, store, status, error, scraped_at)
```

### Cron strategy
`api/cron.py` — iterates `allow_list.json`, calls `fetch_all()` per term × store,
writes to PostgreSQL via `history_writer.py`. Runs daily via GitHub Actions.
Retry mode (`python cron.py --retry`) re-attempts failed term × store pairs
from the last 24h.

`fetch_all()` in `vtex.py` is the cron's entry point into the scraper —
bypasses `search_async` pagination (PAGE_SIZE=10) and fetches in batches
of 50 (VTEX max per request) up to `max_results`.

Sort order: `price_asc` only. History doesn't care about display order.

### Retention
90 days. Cleanup runs as part of the daily cron.

### Size estimate (3 stores, 210 terms, avg 60 results, 1x daily, 90 days)
```
210 terms × 3 stores × 60 products × 90 days = ~3.4M price_point rows
At ~60 bytes/row: ~200MB
products table: ~38,000 rows, negligible
Total: ~200MB — well within PostgreSQL free tier on Railway
```

---

## VTEX API findings

Observations from live data across Prezunic, Zona Sul, and Hortifruti.

**Encoding constraint:** httpx re-encodes spaces as `+` in query params
(application/x-www-form-urlencoded spec). VTEX rejects `+` in the `ft`
param with "Bad Request! Scripts are not allowed!". The URL must be built
manually using `urllib.parse.quote()` to preserve `%20`. Documented in
`vtex.py` with a comment — do not revert to httpx params dict.

**Category taxonomy:** Consistently populated across all three stores but
with different taxonomies per store. Same product category, three names:
- Prezunic: "Molho De Tomate"
- Zona Sul: "Molhos"
- Hortifruti: "Atomatados e Molhos"

Cross-store category filtering will need a mapping layer. For MVP, filter
per-store only. `category_path` (full path string) is stored for future use.

**Hortifruti brand field:** Unreliable — Hortifruti sets `brand: "Hortifruti"`
on all products regardless of actual brand. Barilla, Pomarola, and other
third-party brands all show as "Hortifruti". Brand is only trustworthy for
Prezunic and Zona Sul.

**EAN:** Reliable on Prezunic and Zona Sul. Sparse on Hortifruti — many
items have empty EAN, particularly fresh/weighted products. Cross-store
product deduplication via EAN works when populated but cannot be enforced
as a constraint. `UNIQUE(vtex_product_id, store)` is the deduplication key.

**measurement_unit / unit_multiplier:** Both fields are present on all
items. For packaged discrete goods across all three stores: `un` / `1.0`.
Hortifruti weighted items use `kg` with a fractional multiplier (e.g. `0.2`
for a 200g item sold by weight). `price / unitMultiplier` gives price per
base unit for these items without additional scraping. Prezunic and Zona Sul
do not expose weight data at API level for packaged goods — name parsing
will be required for those (size appears consistently in product names:
"Arroz Tio João 5kg").

**VTEX full-text search noise:** Permissive matching returns semantically
adjacent results. "ovo" returns egg pasta. "aceto balsamico" does not match
"vinagre balsâmico" — suggests VTEX may have synonym handling or stemming
that is not publicly documented. Worth investigating VTEX search API docs.
For MVP: store everything, filter at display time via category.

---

## What's Shipped

### v0.1 — Reactive cache
- `cache.py` — SQLite cache layer, 4h passive TTL, SHA-256 key, startup purge
- `main.py` — FastAPI lifespan initializes DB, `/search` endpoint with
  cache-aside pattern, `_cache` metadata block in response
- `scraper/vtex.py` — parallel async VTEX scraping, httpx + asyncio,
  percent-encoding fix for `ft` param

### v0.2 — Price history foundation
- `scraper/vtex.py` — `parse_product` extended with `category`, `category_path`,
  `measurement_unit`, `unit_multiplier`; `fetch_all()` added for cron use
- `db.py` — asyncpg connection pool, PostgreSQL schema init (products,
  price_points, scrape_log)
- `history_writer.py` — `upsert_products()`, `insert_price_points()`,
  `log_scrape()`
- `cron.py` — allow-list iteration, multi-page fetching via `fetch_all()`,
  retry mode for failed terms
- `allow_list.json` — ~210 canonical terms across 9 categories, per-term
  `max_results`
- `specs/priceHistory.md` — full feature spec

---

## Open Questions

1. **Allow-list wiring into cache** — fuzzy filter on `/search` to prevent
   cache flooding. Threshold value TBD.

2. **Cache fallback on VTEX failure** — serve stale data with `stale: true`
   flag instead of deleting on TTL expiry.

3. **Cross-store category mapping** — Prezunic/Zona Sul/Hortifruti use
   different category names for the same products. Mapping layer needed
   for unified filtering.

4. **Cron parallelization** — implemented via `asyncio.gather` with per-store semaphores in `api/cron.py`.

5. **Unification of cache and history** — deferred to v2. Both layers
   observe the same products but serve different consumers.

6. **VTEX synonym/stemming behavior** — "aceto balsamico" vs "vinagre
   balsâmico" mismatch suggests undocumented search behavior. Worth
   investigating VTEX Intelligent Search documentation.