# monopop-intel

Market price intelligence for the Monopop ecosystem.

## What it does

Tracks supermarket prices in Rio de Janeiro so you know what the market charges today — not what you paid last time.

## Why it exists

[Monopop](https://github.com/mahjard/monopop) helps you manage what you have and what you buy. Intel tells you what it should cost. Together they close the loop: know your stock, know the market, buy smarter.

## Stack

- **Scraper** — Python + httpx (VTEX API)
- **API** — FastAPI
- **Web** — Next.js with Server Components

## Status

🌱 Early development. v0.1 targets Guanabara supermarket via public VTEX API.