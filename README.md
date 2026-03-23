# monopop-intel

Market price intelligence for the Monopop ecosystem.  
**Live:** [monopop-intel.vercel.app](https://monopop-intel.vercel.app)  
**API:** [monopop-intel.up.railway.app/docs](https://monopop-intel.up.railway.app/docs)

## What it does

Tracks supermarket prices in Rio de Janeiro so you know what the market charges
today — and what it charged last week. Search across multiple supermarkets
simultaneously, sort by price, paginate through results, and query price history
for any tracked product over time.

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

# Web
cd web
npm install
npm run dev
API: http://localhost:8000/docs
Web: http://localhost:3000

Required env vars:

Variable	Description
DATABASE_URL	PostgreSQL connection string
Status
🌱 v0.1 — MVP: reactive search across 2 supermarkets, sort, pagination
🌱 v0.2 — 3 stores live, SQLite reactive cache, price history foundation:
PostgreSQL schema, daily cron, hourly retry, allow-list-driven scraping
🌱 v0.3 — Price history read layer shipped: API endpoints + full history UI
  (`/history`, `/history/{term}`, `/history/{term}/{product_id}`)
Limitations
Current coverage is limited to stores with publicly accessible VTEX APIs.
Price history coverage is limited to allow-listed terms (~210 canonical terms
in `api/allow_list.json`); ad-hoc searches are not persisted.
Stale cache fallback on VTEX failure is planned for v2.

See NOTES.md for open engineering questions and design rationale.