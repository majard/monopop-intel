# NOTES — Data Layer Design

Engineering notes for the monopop-intel data layer.
Not a spec — a record of reasoning. Things marked **open** are unresolved.
Update as decisions get made.

---

## Context

The current stack is a FastAPI backend with parallel async scraping via httpx + asyncio,
hitting VTEX public APIs for Prezunic, Zona Sul, and Hortifruti. Results are served
directly to a Next.js 15 frontend with no caching or persistence layer.

Two problems this creates:
- Every search hits the VTEX API live. VTEX responses are frail — timeouts happen,
  empty results happen, and there's no fallback.
- No price history. Every search result is ephemeral.

The data layer we're designing addresses both, but they're separate concerns
with different schemas and different consumers. We're building them separately for now.

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

**Fallback behavior (not yet implemented in v1):** When a cache row is stale,
attempt a live VTEX call first. If VTEX succeeds, update the row and return fresh.
If VTEX fails (timeout, empty result, error), return the stale row anyway with a
`stale: true` flag. The cache is a safety net, not just a performance optimization.
This means rows are never deleted solely because they're old — only replaced by
a successful fresh scrape.

**v1 behavior (current):** Passive TTL only. Stale rows are deleted on read.
No fallback to stale data on VTEX failure. This is good enough to ship and test
the wiring. The fallback behavior is the meaningful upgrade.

### Cache key design
Key is `SHA-256(store:normalized_query:sort:page)`. All four parameters are
included because `prezunic:arroz:price_asc:1` and `prezunic:arroz:relevance:1`
are different result sets.

Query normalization: lowercase, strip accents, strip non-alphanumeric, collapse
whitespace. Adapted from the similarity utils in the Monopop app.

The key is a hash (not the raw string) for consistent length and to avoid
edge cases with special characters in SQLite primary keys.

### Allow-list (not yet implemented)
**Open: allow-list design.**

The key space is unbounded because queries are free text. Without a filter,
a malicious or careless client could generate infinite unique cache keys,
growing the DB indefinitely. This is sometimes called cache flooding.

Proposed mitigation: an allow-list of ~200–250 canonical product terms stored
in a flat JSON file (`api/allow_list.json`), version-controlled. Before caching,
the query is matched against the allow-list using fuzzy similarity (same
`calculateSimilarity` logic from Monopop). If no match is found above a
confidence threshold, the query passes through live but is not cached.

Key design decision: the allow-list is a **reject filter**, not a normalization
target. A query that matches "arroz" is cached under its normalized form
("arroz tio joao", "arroz tipo 1"), not collapsed to "arroz". Brand and
variant intent is preserved. The allow-list only answers: "is this query
cacheable at all?"

**Open: threshold value.** Monopop uses 0.55 for product matching. The allow-list
use case may want a lower threshold (more permissive) since we're just
pattern-matching against broad category terms, not identifying specific products.

**Open: allow-list contents.** Starting point is the personal shopping list
(~110 items). Needs expansion to ~220–250 to cover ~90% of Brazilian household
searches. Categories: grãos/massas, hortifruti, proteínas, laticínios/frios,
condimentos/temperos, bebidas, limpeza, higiene, pet. Full list TBD.

**Open: store-term affinity.** Some terms are only meaningful for specific
stores — FLV items (quiabo, açaí, chuchu) are primarily Hortifruti.
The allow-list could carry metadata indicating which stores to query per term,
so the cron doesn't make pointless requests. Low priority for now.

---

## Layer 2 — Price History

### Purpose
A persistent record of prices over time. Feeds future analytics, inflation
tracking, and the cross-reference engine (top-down vs bottom-up prices).
Not a cache — rows are never invalidated, only appended.

### Schema (open)
Normalized, not blob. Each price observation is its own row. This makes
time-series queries possible without deserializing JSON.

```
products(id, vtex_product_id, store, name, brand, ean, url)
price_points(id, product_id, price, list_price, available, scraped_at)
```

This is structurally different from the cache even though the underlying
data is the same. The cache stores search result blobs for fast retrieval.
The history stores individual product observations for analysis.

They will overlap in practice — the cron and reactive cache will both observe
the same products. That overlap is acceptable for now. Unifying them is a v2
concern.

### Cron strategy (not yet implemented)
GitHub Actions scheduled workflow, running once or twice daily against
a fixed list of terms from the allow-list. Results written to the history
DB (PostgreSQL on Railway, not SQLite — needs to persist across runs).

Sort order for cron: price_asc only. History doesn't care about display
order — it cares about the cheapest available price at a given moment.
The sort dimension disappears from the history schema.

Results per term: full 50-result pages (VTEX max), up to ~5 pages.
Rationale: searches like "ovos" return a lot of noise (macarrão com ovos,
etc.) — more results gives the post-processing step more signal to work with.

**Open: noise filtering.** The VTEX full-text search returns semantically
adjacent results that aren't the target product. "Ovos" returns egg pasta.
This needs either query refinement (VTEX category filters, if supported)
or post-processing before writing to history. Not a cache problem — a
search quality problem. Needs its own design pass.

### Retention
90 days. Enough for inflation signal and seasonal variation.
Max 2 observations per product per day (one per cron run), enforced by
upsert logic on (product_id, date(scraped_at)).
After 90 days, rows are deleted in batch (nightly cleanup job or cron).

### Size estimate (3 stores, 250 terms, 50 results, 2x daily, 90 days)
```
250 terms × 3 stores × 50 products × 2 daily × 90 days = ~6.75M price_point rows
At ~50 bytes per row: ~340MB
products table: ~37,500 rows, negligible
Total: ~340MB — manageable in PostgreSQL, borderline for SQLite
```
This estimate assumes full allow-list coverage and zero deduplication.
Real-world number will be lower (not every term returns 50 unique products,
deduplication by EAN will collapse variants).

---

## What's Shipped (v1)

- `cache.py` — SQLite cache layer with 4h passive TTL, SHA-256 key,
  query normalization, startup purge of expired rows.
- `main.py` — FastAPI lifespan initializes DB, `/search` endpoint
  wired with cache-aside pattern. Response includes `_cache` metadata block.

v1 is correct for what it does. The allow-list and fallback behavior
are the meaningful upgrades. Test and commit v1 before building further.

---

## Open Questions (summary)

1. Allow-list: final term list, threshold value, store affinity metadata
2. Fallback behavior: stale cache on VTEX failure (Layer 1 upgrade)
3. Noise filtering: post-processing VTEX results before caching/storing
4. History DB: PostgreSQL schema, Railway setup, cron workflow
5. Normalization: port `preprocessName` from Monopop or rewrite in Python
6. Unification: cache + history as one store (deferred to v2)