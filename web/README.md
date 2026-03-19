# monopop-intel — web

Next.js 15 frontend for the monopop-intel API.

## Architecture

Server Components throughout — data fetching happens on the server, the browser receives rendered HTML with no client-side fetch. Navigation (sort, pagination, store selection) is driven entirely by URL params, keeping the app stateless and crawlable.

No `useState`, no `useEffect`, no loading spinners managed in JS. The `loading.tsx` file handles suspense at the framework level.

## Running locally
```bash
npm install
npm run dev
```

Requires the API running on `http://localhost:8000`.  
See the [root README](../README.md) for full setup instructions.

## Key files

- `app/page.tsx` — main search page, Server Component
- `app/loading.tsx` — loading skeleton shown during server fetch