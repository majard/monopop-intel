# monopop-intel

Market price intelligence for the Monopop ecosystem.
**Live:** [monopop-intel.vercel.app](https://monopop-intel.vercel.app)  
**API:** [monopop-intel.up.railway.app/docs](https://monopop-intel.up.railway.app/docs)

## What it does

Tracks supermarket prices in Rio de Janeiro so you know what the market charges today — not what you paid last time. Search across multiple supermarkets simultaneously, sort by price, and paginate through results.

## Why it exists

[Monopop](https://github.com/majard/monopop) helps you manage what you have and what you buy. Intel tells you what it should cost. Together they close the loop: know your stock, know the market, buy smarter.

## Stack

- **Scraper** — Python + httpx + asyncio, leveraging publicly available VTEX e-commerce APIs for low-friction data acquisition
- **API** — FastAPI, parallel requests across stores with unified response schema
- **Web** — Next.js 15 with Server Components

## Technical highlights

- **Parallel async fetch** — simultaneous requests across stores via `asyncio.gather`, ~50% latency reduction vs sequential
- **Server Components** — data fetching on the server, browser receives rendered HTML with zero client-side JS for search logic
- **Deterministic multi-store sort** — tiebreaker `(price, product_id, store)` ensures stable pagination across independent store results
- **Zero-auth data acquisition** — VTEX public API returns clean JSON with no scraping required; Playwright reserved for non-VTEX targets
- **Auto-generated API docs** — OpenAPI/Swagger via FastAPI at `/docs`, always in sync with the code

## Current coverage

| Store | Platform | Status |
|---|---|---|
| Prezunic | VTEX | ✅ Live |
| Zona Sul | VTEX | ✅ Live |
| Hortifruti | VTEX | ✅ Live |

See [RADAR.md](./RADAR.md) for full market coverage roadmap.

## Running locally
```bash
# API
cd api
pip install -r requirements.txt
uvicorn main:app --reload

# Web
cd web
npm install
npm run dev
```

API: `http://localhost:8000/docs`  
Web: `http://localhost:3000`

## Limitations

Current coverage is limited to stores with publicly accessible APIs. Next steps include scraping-based and proxy-based ingestion for broader coverage.

## Status

🌱 v0.1 — MVP built to validate architecture and data acquisition strategy. Two supermarkets live, multi-store comparison, sort and pagination.