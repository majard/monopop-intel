# Price History — Feature Spec
**Project:** monopop-intel  
**Branch:** feature/price-history  

---

## Overview

A persistent, time-series record of supermarket prices across Rio de Janeiro.
Complements the reactive cache (which serves current prices fast) with a
normalized history layer that answers a different question: not "what does
arroz cost now?" but "how has the price of arroz changed over the last 90 days?"

The allow-list drives everything. We don't track arbitrary products — we track
what the allow-list terms produce. The ~220 canonical terms are the scope of
the price history, not the full VTEX catalog.

One data flow feeds it:

- **Cron (proactive):** GitHub Actions scrapes the allow-list once daily,
  price_asc, writes every observation to PostgreSQL. Reactive user searches
  do not write to history for MVP — cron-only keeps the write path clean and
  avoids storing noise queries.

---

## Why PostgreSQL and not SQLite

SQLite lives on the Railway instance filesystem. Railway deployments are
ephemeral — the filesystem is reset on redeploy. SQLite is correct for the
reactive cache (a cold miss just re-scrapes). It is wrong for history, where
losing 90 days of data on a deploy is unacceptable.

PostgreSQL on Railway persists across deploys and is available on the free tier.

---

## Schema

Two tables. Normalized — each price observation is its own row, not a blob.
This makes time-series queries possible without deserializing JSON.

```sql
CREATE TABLE products (
    id              SERIAL PRIMARY KEY,
    vtex_product_id TEXT        NOT NULL,
    store           TEXT        NOT NULL,  -- 'prezunic' | 'zonasul' | 'hortifruti'
    name            TEXT        NOT NULL,
    brand           TEXT,
    ean             TEXT,
    category        TEXT,                  -- leaf: 'Molho De Tomate'
    category_path   TEXT,                  -- full: '/Mercearia/Molhos e Condimentos/Molho De Tomate/'
    url             TEXT,
    measurement_unit    TEXT,    -- VTEX items[0].measurementUnit: 'un' | 'kg' | 'ml'
    unit_multiplier     REAL,    -- VTEX items[0].unitMultiplier: e.g. 0.2 for a 200g item priced per kg
    UNIQUE (vtex_product_id, store)
);

CREATE TABLE price_points (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER         NOT NULL REFERENCES products(id),
    term        TEXT            NOT NULL,  -- allow-list term that produced this observation
    price       NUMERIC(10,2),
    list_price  NUMERIC(10,2),
    available   BOOLEAN         NOT NULL DEFAULT true,
    scraped_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_points_product_scraped
    ON price_points (product_id, scraped_at DESC);

CREATE INDEX idx_price_points_term
    ON price_points (term, scraped_at DESC);

CREATE TABLE scrape_log (
    id          SERIAL PRIMARY KEY,
    term        TEXT        NOT NULL,
    store       TEXT        NOT NULL,
    status      TEXT        NOT NULL,  -- 'ok' | 'failed'
    error       TEXT,
    scraped_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Key decisions

**`term` column on price_points.** Since the allow-list drives the cron,
every price observation is associated with the term that produced it. This
is the primary read path for the history UI — "show me price history for
the term arroz" — and avoids a separate join table.

**EAN as signal, not primary key.** EAN is the right key for cross-store
identity but VTEX doesn't always populate it — Hortifruti items frequently
have empty EAN. Deduplication is `UNIQUE(vtex_product_id, store)` as the
hard constraint. EAN is stored for future cross-store matching but not
enforced.

**`NUMERIC(10,2)` not `REAL`.** Floating point drift in price data is
immediately visible to users. NUMERIC is exact at the cost of slightly more
storage.

**One row per observation, no daily upsert.** The cron runs once daily.
Rather than enforcing a max-1-per-day constraint at write time, we store
every observation and filter at read time. Simpler writes, flexible queries.
Retention handles growth.

---

## Data acquisition

### Allow-list

~220 canonical product terms in `api/allow_list.json`. The cron iterates
this list and scrapes each term from each store. Terms are normalized before
scraping (lowercase, strip accents) matching VTEX's expected input.

Sort order: `price_asc` only. History doesn't care about display order —
it cares about what products were available and at what price.

Results per term: up to 50 per store (VTEX max per request, page 1 only
for MVP). 50 results covers the relevant catalog for most terms, including
noisy ones like "ovos".

### Noise

VTEX full-text search is permissive. "ovos" returns "Macarrão com Ovos".
For MVP: store everything. Category is surfaced in the UI as a label on
each product card so coverage can be assessed visually. Filtering is
available as a user-initiated action (see Frontend section) but not
enforced automatically.

### Cron schedule

```yaml
# .github/workflows/scrape.yml
on:
  schedule:
    - cron: '0 9 * * *'   # 9h UTC = 6h BRT — after overnight price updates
```

Once per day. Failed terms are retried hourly until successful (see
Operational section).

---

## Write path

```
cron iterates allow_list.json
    ↓
for each term × store:
    search_async(term, store, sort="price_asc", page=1)
        ↓
    history_writer.upsert_products(products, term)
        → INSERT ... ON CONFLICT (vtex_product_id, store) DO NOTHING
        ↓
    history_writer.insert_price_points(products, term)
        → INSERT price_points (one row per product)
        ↓
    scrape_log.write(term, store, status)
```

Both write operations are idempotent. If the cron runs twice in a day,
`upsert_products` is a no-op for existing products and `insert_price_points`
appends a second observation — acceptable, filtered at read time.

---

## Operational

### Idempotency

`upsert_products` uses `INSERT ... ON CONFLICT DO NOTHING` — safe to run
multiple times. `insert_price_points` always appends — multiple runs produce
multiple rows for the same day, which is acceptable and queryable.

### Failure handling and retry

Every term × store scrape writes a row to `scrape_log` with `status='ok'`
or `status='failed'`. A second GitHub Actions workflow runs hourly and
retries only the terms that failed in the most recent daily run:

```yaml
# .github/workflows/retry.yml
on:
  schedule:
    - cron: '0 * * * *'   # every hour
```

The retry job queries `scrape_log` for failed terms from the last 24h with
no subsequent success, and re-attempts them. Stops retrying once a term
succeeds or after 6 attempts within the same calendar day. The next daily
run resets the attempt count.

### Retention

90 days. Cleanup runs as part of the daily cron:

```sql
DELETE FROM price_points WHERE scraped_at < NOW() - INTERVAL '90 days';
DELETE FROM scrape_log   WHERE scraped_at < NOW() - INTERVAL '90 days';
```

Products with no remaining price_points are left in place.

### Size estimate (3 stores, 220 terms, 50 results, 1x daily, 90 days)

```
220 terms × 3 stores × 50 products × 90 days = ~2.97M price_point rows
At ~60 bytes/row (with term column): ~180MB
products table: ~33,000 rows, negligible
scrape_log: ~60K rows/90 days, negligible
Total: ~180MB — well within PostgreSQL free tier on Railway
```

---

## Read path — `/history` API endpoints

```
GET /history/terms
    → list of allow-list terms with last_scraped_at and product count per store

GET /history/term/{term}?store=prezunic&category=Arroz
    → products for this term, latest price per product
    → category param optional — filters on products.category in DB
    → store param optional — defaults to all stores

GET /history/product/{product_id}?days=30
    → price_points for this product over the last N days
    → ordered by scraped_at ASC for charting
```

Category filter is server-side (PostgreSQL `WHERE category = ?`), not
in-memory. If category data turns out to be unreliable, the filter param
is simply ignored by the user — no code change needed.

---

## Frontend — `/history` page

Three levels, separate Next.js routes. Server components throughout.

```
/history
    → grid of tracked terms
    → each card: term name, store coverage, last scraped, product count
    → searchable by term name (query param → server fetch)

/history/[term]
    → list of products for this term
    → each product: name, brand, current price, category label, store badge
    → price trend indicator: ↑ ↓ → (compare latest vs 7 days ago)
    → optional category filter (dropdown → query param → server fetch)
    → optional store filter

/history/[term]/[product_id]
    → price chart (Recharts LineChart, time on x-axis, price on y-axis)
    → time range selector: 30 / 60 / 90 days
    → raw observations table below chart
    → product metadata: store, category, EAN if available
```

Category is shown as a label on every product card from day one — makes
coverage immediately visible without building a filter first. The filter
is additive and already wired; if categories look reliable after a few
days of data, users can start filtering without any further changes.

---

## New files

```
api/db.py                        — asyncpg connection pool, schema init
api/history_writer.py            — upsert_products(), insert_price_points()
api/cron.py                      — iterates allow_list.json, writes to history
.github/workflows/scrape.yml     — daily cron
.github/workflows/retry.yml      — hourly retry for failed terms
```

## Modified files

```
api/scraper/vtex.py    — parse_product() extended with category, category_path
api/main.py            — new /history/* endpoints
api/requirements.txt   — asyncpg added
web/app/history/       — new Next.js routes
```

---

## Future compatibility — unit pricing

VTEX exposes `measurementUnit` and `unitMultiplier` at the item level.
Both are stored in the `products` table but not used for MVP.

`unitMultiplier` is the key: for a 200g item sold by weight,
`unitMultiplier=0.2` (base unit is kg). `price / unitMultiplier` gives
price per base unit without any additional scraping.

Prezunic and Zona Sul set `measurementUnit=un` and `unitMultiplier=1.0`
for discrete packaged goods — no weight data exposed at API level.
Hortifruti populates these correctly for weighted items.

When Monopop's unit system (v1.7.0) connects to monopop-intel, this
data plugs in directly: same atomic unit conventions (`g`, `ml`, `un`),
same price-per-unit derivation logic. Shrinkflation detection follows
naturally from price_points over time combined with unit_multiplier changes.

---

## Out of scope for MVP

- Cross-store product identity (EAN merging) — v2
- Reactive writes to history (user searches) — v2
- Price alerts / notifications — v2
- Bottom-up data (Monopop consumer prices) — v2.0 per RADAR
- Guanabara / Mundial / Carrefour / Extra — pending RADAR v0.2+
- Shrinkflation detection — future
- Export / download of price history data — future
- Automated category-based noise filtering — future (assess coverage first)

---

## Open questions

1. **Retry window:** should failed terms from a previous calendar day be
   retried by the next morning's cron, or only within the same calendar day?
   Current spec: 6 hourly attempts within 24h, then the next daily run
   picks it up naturally.

2. **Trend indicator threshold:** what delta constitutes ↑ vs → vs ↓?
   Suggest >2% change = arrow, ≤2% = flat. Needs confirmation before
   building the frontend indicator.

3. **Price chart granularity:** one point per day (latest observation) or
   all observations? One per day is cleaner for visualization. All
   observations future-proofs for multiple daily runs.