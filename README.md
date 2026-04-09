# monopop-intel

Market price intelligence for the Monopop ecosystem.  
**Live:** [monopop-intel.vercel.app](https://monopop-intel.vercel.app)  
**API:** [monopop-intel.up.railway.app/docs](https://monopop-intel.up.railway.app/docs)

## What it does

Tracks supermarket prices in Rio de Janeiro so you know what the market charges
today — and what it charged last week. Search across Prezunic, Zona Sul, and
Hortifruti simultaneously, sort by price or price-per-unit, and query price
history for any tracked product over time. Browse normalised generic product
pages to compare prices across stores and brand variants, and manage shopping
lists that you can populate from generics, pin to specific store prices, and
export as Monopop-compatible JSON or as plain text ready to paste into WhatsApp
or anywhere else.

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
- **Web** — Next.js 15 with Server Components and selective ISR revalidation
- **Cron** — GitHub Actions; daily scrape + hourly retry for failures

## Architecture

```
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
└─► cron.py ──► fetch_all() per term/store (most-specific terms first)
     ──► upsert products → PostgreSQL
     ──► insert price_points → PostgreSQL
     ──► log_scrape() → scrape_log
     ──► POST /api/revalidate → invalidate Vercel ISR cache

GitHub Actions (hourly)
│
└─► cron.py --retry ──► re-scrape failed (term, store) pairs

Browser request (generics/history pages)
│
▼
Vercel edge (ISR, revalidate 4h)
│
└─► Railway/FastAPI (on cache miss only)
     └─► PostgreSQL
```

## Data layer

### Reactive cache (Layer 1 — SQLite)
- Cache key: `SHA-256(store:normalized_query:sort:page)`
- TTL: 4 hours. Stale rows deleted on read (no stale fallback yet — planned v2)
- Normalization: lowercase, strip accents, strip non-alphanumeric, collapse whitespace
- Scope: search results only. Generics and history pages bypass this layer.

### Price history (Layer 2 — PostgreSQL)
- Schema: `products`, `price_points`, `scrape_log`
- Uniqueness: one product per `(vtex_product_id, store)`; one price observation
  per `(product_id, scrape_date)`
- Allow-list: ~220 canonical terms in `api/allow_list.json` with per-term
  `max_results`; acts as a reject-filter, not a normalizer
- Cron sort: terms are scraped most-specific first (word count descending) so
  that "arroz integral" wins the daily `ON CONFLICT DO NOTHING` race before
  "arroz", keeping `generic_name` assignments precise
- Retention: 90 days

### Generics (Layer 3 — parsed fields on `products`)
- Schema: five nullable columns added to `products`:
  `generic_name`, `parsed_brand`, `package_size`, `unit`, `is_noise`
- Parser: `api/parsers/product_normalizer.py` — `clean_and_classify()` uses a
  two-stage pipeline: `is_salient_match()` as a cheap token-level gate (does
  this term appear meaningfully in the product name?), then `compute_fuzzy_score()`
  as the scorer that ranks all candidates that passed the gate. Longer (more
  specific) terms win ties — "arroz integral" beats "arroz" for matching products.
  Also extracts package size/unit (including Brazilian compound formats) and
  infers brand via DB hint → known brands JSON → positional heuristics.
- Backfill: `backfill_clean_generics.py` — idempotent async script; supports
  `--force`, `--batch`, and `--limit` for incremental runs; triggers ISR
  revalidation on completion
- Noise filtering: `is_noise=true` products excluded by default from
  `/generics/{term}` responses

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
- **Specificity-first cron ordering** — allow-list terms are sorted by word
  count descending before each scrape run; ensures the most specific term wins
  the daily uniqueness constraint, keeping generic classifications precise
- **Two-stage fuzzy classifier** — `is_salient_match()` gates on token-level
  presence (fast, cheap), `compute_fuzzy_score()` ranks among survivors
  (slower, more precise); complementary roles prevent both false positives and
  false negatives in generic name assignment
- **Server Components with selective hydration** — data fetching on the server;
  client components (`ShoppingListsProvider`, `GenericProductList`) are mounted
  only where interactivity is needed, preserving SSR for all browsing pages
- **ISR cache revalidation** — `cron.py` and `backfill_clean_generics.py` POST
  to `/api/revalidate` with `x-revalidate-token` after writes, invalidating the
  Next.js ISR cache for `/generics` and `/history` without a full redeploy;
  data is fresh within minutes of each cron cycle
- **Deterministic multi-store sort** — tiebreaker `(price, product_id, store)`
  ensures stable pagination across independent store results
- **Fuzzy generic matching** — `clean_and_classify()` scores each product name
  against all allow-list terms; selects the longest (most specific) match above
  threshold as `generic_name`, enabling normalised grouping across stores and
  brand variants
- **Cross-store canonical grouping** — `make_canonical_key()` normalises
  brand (NFKD accent strip + lowercase), package size (2-decimal string),
  and unit into a pipe-delimited key; the `/generics/{term}` endpoint groups
  products across stores by `brand_size`, `size_only`, or `brand_only` and
  exposes `price_stats` (min/max/avg) per group
- **Price-per-unit normalisation** — `price_per_unit` derived per product from
  `price / package_size` with threshold-based `g`/`ml` rescaling; the
  best-per-unit variant is labelled across both flat and grouped views
- **localStorage shopping lists** — `useShoppingLists` hook (context provider)
  persists multiple named lists under `mintel-shopping-lists`; no auth, no
  server state; items carry `genericName`, quantity, optional `productId` pin,
  `pinnedPrice`, and preferred size/unit for export price resolution
- **Paste-driven fuzzy import** — free-text lists are line-tokenised and scored
  against known generics using a blended similarity metric (bigram Dice
  coefficient + token overlap + Levenshtein); mid-confidence matches (55–89)
  surface a per-line review step before committing
- **Dual export formats** — `buildShoppingListExport` resolves per-store prices
  for each list item (pinned price, or best `price` / `price_per_unit` from the
  generics cache) and emits a typed `MonopopExport` JSON payload; alternatively
  `buildShoppingListText` produces a strategy-aware plain-text summary (WhatsApp-
  ready, with pinned products shown by actual product name and filled prices
  labelled per store)

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
cp .env.example .env          # set DATABASE_URL, REVALIDATE_TOKEN, WEB_URL
pip install -r requirements.txt
uvicorn main:app --reload

# Price history cron (manual run)
cd api
python cron.py                # full scrape
python cron.py --retry        # retry last 24h failures
python cron.py --limit 5      # scrape first 5 terms only (dev/debug)

# Generics backfill (after schema migration or allow-list changes)
cd api
python backfill_clean_generics.py            # backfill products with generic_name IS NULL
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
```

API: http://localhost:8000/docs
Web: http://localhost:3000

### Required env vars

| Variable | Where | Description |
|----------|-------|-------------|
| `DATABASE_URL` | Railway + local | PostgreSQL connection string |
| `REVALIDATE_TOKEN` | Railway + Vercel | Shared secret for ISR cache invalidation |
| `WEB_URL` | Railway | Base URL of the Next.js app (cron posts revalidation here) |
| `NEXT_PUBLIC_API_URL` | Vercel + local | FastAPI base URL consumed by the Next.js frontend |

## Status

```
🌱 v0.1 — MVP: reactive search across 2 supermarkets, sort, pagination
🌱 v0.2 — 3 stores live, SQLite reactive cache, price history foundation
🌱 v0.3 — Price history read layer: /history, /history/{term}, /history/{term}/{product_id}
🌱 v0.4 — Generics layer: product name normalisation, brand/size parsing,
           backfill pipeline, cross-store canonical grouping, price-per-unit
           sorting, /generics UI ("básicos")
🌱 v0.5 — Shopping lists + full generics UI: multi-list manager, paste-driven
           fuzzy import, variant pinning, dual export (Monopop JSON + plain text);
           ISR revalidation; sitemap; support/donation page; essentials section;
           search-to-generics linking; allow-list expanded to ~220 terms
```

## Limitations

- Coverage limited to stores with publicly accessible VTEX APIs
- Stale search cache fallback on VTEX failure planned for v2 (currently returns error)
- 90-day price-point retention cleanup not yet automated
- Generic name parsing is v1; noise rate ~20%, known edge cases in short/ambiguous
  product names and ingredient-modifier constructions
— see `NOTES.md` for open engineering questions.