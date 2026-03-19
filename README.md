# monopop-intel

Market price intelligence for the Monopop ecosystem.

## What it does

Tracks supermarket prices in Rio de Janeiro so you know what the market charges today — not what you paid last time. Search across multiple supermarkets simultaneously, sort by price, and paginate through results.

## Why it exists

[Monopop](https://github.com/mahjard/monopop) helps you manage what you have and what you buy. Intel tells you what it should cost. Together they close the loop: know your stock, know the market, buy smarter.

## Stack

- **Scraper** — Python + httpx + asyncio (VTEX public API, parallel multi-store fetch)
- **API** — FastAPI
- **Web** — Next.js with Server Components

## Current coverage

| Store | Platform | Status |
|---|---|---|
| Prezunic | VTEX | ✅ Live |
| Zona Sul | VTEX | ✅ Live |

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

## Status

🌱 v0.1 — two supermarkets live, multi-store comparison, sort and pagination. Deploy coming soon.