# monopop-intel

Market price intelligence for the Monopop ecosystem.  
**Live:** [monopop-intel.vercel.app](https://monopop-intel.vercel.app)  
**API:** [monopop-intel.up.railway.app/docs](https://monopop-intel.up.railway.app/docs)

## What it does

Tracks supermarket prices in Rio de Janeiro so you know what the market charges
today — and what it charged last week. Search across multiple supermarkets
simultaneously, sort by price, paginate through results, and query price history
for any tracked product over time. Browse normalised generic product pages to
compare prices across stores and brand variants, and manage shopping lists that
you can populate from generics, pin to specific store prices, and export as
Monopop-compatible JSON or text ready to paste anywhere else.

## Why it exists

[Monopop](https://github.com/majard/monopop) helps you manage what you have
and what you buy. Intel tells you what it should cost. Together they close the
loop: know your stock, know the market, buy smarter.

## Stack

- **Scraper** — Python + httpx + asyncio, leveraging publicly available VTEX
  e-commerce APIs for low-friction data acquisition
- **Reactive cache** — SQLite + aiosqlite; absorbs repeated searches, 4h TTL
- **Price history** — PostgreSQL + asyncpg; daily time-series of prices per
  product, driven by an allow-list cron
- **API** — FastAPI, parallel requests across stores with unified response schema
- **Web** — Next.js 15 with Server Components
- **Cron** — GitHub Actions; daily scrape + hourly retry for failures

## Architecture
Search request
│
▼
FastAPI /search
│
├─► SQLite cache (4h TTL) ──► return cached result
│
└─► VTEX scraper (httpx + asyncio) ──► cache + return

GitHub Actions (daily 09:00 UTC)
│
└─► cron.py ──► fetch_all() per term/store
──► upsert products → PostgreSQL
──► insert price_points → PostgreSQL
──► log_scrape() → scrape_log

GitHub Actions (hourly)
│
└─► cron.py --retry ──► re-scrape failed (term, store) pairs


## Data layer

### Reactive cache (Layer 1 — SQLite)
- Cache key: `SHA-256(store:normalized_query:sort:page)`
- TTL: 4 hours. Stale rows deleted on read (no stale fallback yet — planned v2)
- Normalization: lowercase, strip accents, strip non-alphanumeric, collapse whitespace

### Price history (Layer 2 — PostgreSQL)
- Schema: `products`, `price_points`, `scrape_log`
- Uniqueness: one product per `(vtex_product_id, store)`; one price observation
  per `(product_id, scrape_date)`
- Allow-list: ~210 canonical terms in `api/allow_list.json` with per-term
  `max_results`; acts as a reject-filter, not a normalizer
- Retention: 90 days

### Generics (Layer 3 — parsed fields on `products`)
- Schema: five new nullable columns added to `products`:
  `generic_name`, `parsed_brand`, `package_size`, `unit`, `is_noise`
- Parser: `api/parsers/product_normalizer.py` — `clean_and_classify()` normalises
  raw product names against allow-list terms using fuzzy matching, extracts
  package size/unit (including Brazilian formats), and infers brand
- Backfill: `backfill_clean_generics.py` — idempotent async script; supports
  `--force`, `--batch`, and `--limit` for incremental runs
- Noise filtering: `is_noise=true` products are excluded by default from
  `/generics/{term}` responses (`exclude_noise=true`)

## Technical highlights

- **Parallel async fetch with per-store concurrency control** — `asyncio.Semaphore`
  limits concurrent requests per store independently; prevents hammering any
  single store while maximising overall throughput
- **Idempotent write pipeline** — `ON CONFLICT DO NOTHING` throughout; the daily
  cron and hourly retry can run multiple times safely with no duplicate rows
- **Scrape log-driven retry** — the retry workflow queries `scrape_log` for
  failures in the last 24h that have no later success, then re-enqueues only
  those `(term, store)` pairs — no fixed retry counter, no dead-letter queue
- **Allow-list as reject filter** — `allow_list.json` gates what enters the
  price history; queries that don't match a known term are never persisted,
  preventing unbounded table growth
- **Server Components** — data fetching on the server; the browser receives
  rendered HTML with zero client-side JS for search logic
- **Deterministic multi-store sort** — tiebreaker `(price, product_id, store)`
  ensures stable pagination across independent store results
- **Zero-auth data acquisition** — VTEX public API returns clean JSON with no
  scraping required
- **Fuzzy generic matching** — `clean_and_classify()` scores each product name
against all allow-list terms using salience checks and a fuzzy ratio threshold;
selects the best match as `generic_name`, enabling normalised grouping across
stores and brand variants
- **Cross-store canonical grouping** — `make_canonical_key()` normalises
  brand (NFKD accent strip + lowercase), package size (2-decimal string),
  and unit into a pipe-delimited key; the `/generics/{term}` endpoint groups
  products across stores by `brand_size`, `size_only`, or `brand_only` and
  exposes `price_stats` (min/max/avg) per group
- **Price-per-unit normalisation** — `price_per_unit` is derived per product
  from `price / package_size` with threshold-based `g`/`ml` rescaling;
  the best-per-unit variant is labelled across both flat and grouped views
- **localStorage shopping lists** — `useShoppingLists` hook persists multiple
  named lists under `mintel-shopping-lists`; no auth, no server state; items
  carry `genericName`, quantity, optional `productId` pin, `pinnedPrice`, and
  preferred size/unit for export price resolution
- **Paste-driven fuzzy import** — free-text lists are line-tokenised and scored
  against known generics using a blended similarity metric (bigram Dice
  coefficient + token overlap + Levenshtein); mid-confidence matches (55–89)
  surface a per-line review step before committing
- **ISR cache revalidation** — `cron.py` and `backfill_clean_generics.py` POST
  to `/api/revalidate` with `x-revalidate-token` after writes, invalidating the
  Next.js ISR cache for `/generics` and `/history` without a full redeploy
- **Monopop export** — `buildShoppingListExport` resolves per-store prices for
  each list item (pinned price, or best `price` / `price_per_unit` from the
  generics cache) and emits a typed `MonopopExport` JSON payload with
  categories, stores, products, inventory items, and shopping list items

## Current coverage

| Store      | Platform | Status  |
|------------|----------|---------|
| Prezunic   | VTEX     | ✅ Live |
| Zona Sul   | VTEX     | ✅ Live |
| Hortifruti | VTEX     | ✅ Live |

See [RADAR.md](./RADAR.md) for full market coverage roadmap.

## Running locally

```bash
# API
cd api
cp .env.example .env          # set DATABASE_URL for PostgreSQL
pip install -r requirements.txt
uvicorn main:app --reload

# Price history cron (manual run)
cd api
python cron.py                # full scrape
python cron.py --retry        # retry last 24h failures
python cron.py --limit 5      # scrape first 5 terms only (dev/debug)

# Generics backfill (after schema migration)
cd api
python backfill_clean_generics.py            # backfill all products with generic_name IS NULL
python backfill_clean_generics.py --force    # re-parse all rows
python backfill_clean_generics.py --limit 500 --batch 100  # dev/debug

# Dry-run the parser against live DB data
python dry_run_parser.py                     # random 3 terms, 10 products each
python dry_run_parser.py --term chocolate --products 20
python dry_run_parser.py --num-terms 5 --verbose 4

# Extract canonical brand list from DB
python extract_brands.py                     # writes parsers/brands.json

# Web
cd web
npm install
npm run dev
API: http://localhost:8000/docs
Web: http://localhost:3000

Required env vars:

| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL connection string |

## Status
🌱 v0.1 — MVP: reactive search across 2 supermarkets, sort, pagination
🌱 v0.2 — 3 stores live, SQLite reactive cache, price history foundation:
🌱 v0.3 — Price history read layer shipped: API endpoints + full history UI
  (`/history`, `/history/{term}`, `/history/{term}/{product_id}`)
🌱 v0.4 — Generics layer + cross-store comparison shipped:
  product name normalisation, brand/size parsing, backfill pipeline,
  cross-store canonical grouping (`brand_size` / `size_only` / `brand_only`),
  price-per-unit sorting, and new `/generics`, `/generics/{term}`,
  `/generics/{term}/{product_id}` API + UI ("básicos")
🌱 v0.5 — Shopping Lists + Generics UI shipped:
  session-only multi-list manager (`/shopping-lists`), paste-driven fuzzy
  import, variant pinning with price lock, Monopop JSON export with store
  price fill strategies; full Generics browsing UI (`/generics`,
  `/generics/{term}`, `/generics/{term}/{product_id}`); sitemap; support page;
  ISR revalidation endpoint; allow-list expanded with 9 new terms
  
PostgreSQL schema, daily cron, hourly retry, allow-list-driven scraping

## Limitations
- Coverage is limited to stores with publicly accessible VTEX APIs.
- Stale cache fallback on VTEX failure is planned for v2.
- 90-day price-point retention cleanup (daily cron DELETE) is not yet implemented
  — see `NOTES.md` for open engineering questions.
- Generic name parsing is v1; known gaps are documented in
  `api/tests/test_product_normalizer.py` file header.