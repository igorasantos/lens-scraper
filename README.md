# Lens Scraper

A local, rate-limited and session-aware web scraper.

Config-driven RPA scraper, built as a Nest CLI monorepo (`apps/api`, `apps/worker`, `libs/*`). It drives a real Playwright browser through an explicit, queued pipeline — paginate a listing, open a record, extract a few DOM selectors, write a file — rather than an AI agent or a vendor scraping API. This file is enough to get it running end to end.

Every DOM selector, URL template, and on-disk filename lives in a JSON file at `SITE_CONFIG_PATH`, validated by `SiteConfigService`. Point that path at a different config and the same pipeline runs against a different site — no code changes.

## Architecture

- **Browser** — Playwright/Chromium. Each request picks a session mode per stage: `listing_mode` (listing init) and `detail_mode` (listing init and every reprocess endpoint), each `logged-in` or `logged-out`. `logged-in` runs in the persistent profile at `BROWSER_PROFILE_DIR` (and whatever session it holds) with the site config's `listing_logged_in` / `detail_logged_in` blocks; `logged-out` runs in a fresh profile-less context with `listing_logged_out` / `detail_logged_out`. A `logged-out` listing reads only the first batch of records at the given URL — no pagination, scrolling or clicks. If the target site needs a logged-in session, `npm run login:bootstrap` opens it headed once; every later run reuses that session. Public sites that need no login skip this entirely (see `SITE_REQUIRES_LOGIN` below).
- **Queue** — Kafka, via a local Redpanda broker. Each pipeline stage is its own topic; listing pagination is one message per page, so no handler blocks the consumer long enough to trigger a rebalance.
- **Lock** — a single Redis mutex; only one worker drives the browser session at a time.
- **Storage** — plain files on disk, outside this repo (`$LOCAL_STORAGE_DIR`, default `../scraped-data`).
- **Ports & adapters** — `QueuePort`, `LockPort`, and `StoragePort` are the only seams into these systems, each with one `local` implementation today, selected by `QUEUE_PROVIDER` / `LOCK_PROVIDER` / `STORAGE_PROVIDER`.

`api` and `worker` always run locally via `npm`, never in Docker — only Redpanda, Redis, and the Redpanda Console UI are containerized.

## Project layout

```
apps/
  api/      HTTP controllers + producers (the only public surface)
  worker/   Kafka consumers that actually drive the browser
            Both apps group src/ by domain — listing/, detail/, titles/, filter/,
            each with its own module, controller, services, dto
            and specs side by side; shared helpers live in common/.
libs/
  browser/     Playwright session management
  site/        Configurable selectors/URLs (SiteConfigService) + DOM parsing (SiteService)
  storage/     Append-only files, dedupe, HTML writers
  queue/       Kafka topics, message shapes, producer wrapper
  redis-lock/  Distributed mutex guarding the browser session
  config/      Typed, validated env var access
```

## Getting started

1. Start the infrastructure (Redpanda + Redis + a Redpanda Console UI):

   ```bash
   docker-compose up -d
   ```

2. Install dependencies and the Playwright browser:

   ```bash
   npm install
   npm run playwright:install
   ```

3. Copy the env and site config examples, and point them at your target:

   ```bash
   cp .env.example .env
   cp config/site.config.example.json config/site.config.json
   ```

   Edit `config/site.config.json` with the target site's real selectors and URL templates (see the shape of the example file), and set `SITE_BASE_LISTING_URL` in `.env`.

4. If the target site requires a login, log in once, headed, so the persistent browser profile has a session:

   ```bash
   npm run login:bootstrap
   ```

   With `SITE_REQUIRES_LOGIN=false` (the default) this step is a no-op — the site is scraped without ever logging in.

5. Run the API and worker (each in its own terminal):

   ```bash
   npm run start:dev
   npm run start:worker
   ```

6. Kick off a crawl:

   ```bash
   curl -X POST http://localhost:3000/scrape/listing/init -H 'Content-Type: application/json' -d '{"listing_mode":"logged-in","detail_mode":"logged-out"}'
   ```

   A ready-made [Bruno](https://www.usebruno.com/) collection for every endpoint lives in [`bruno/`](bruno/).

## Vocabulary

Code, Kafka topics, message shapes, and endpoint paths use `record`/`recordId` and `source`/`sources`.

## Environment variables

See [`.env.example`](.env.example) for the full list — Kafka/Redis connection strings, browser profile location, data directory, pacing/retry limits, `SITE_REQUIRES_LOGIN`, and the `*_PROVIDER` adapter selectors. `SITE_CONFIG_PATH` points at the JSON file describing the target site's selectors and URLs (see [`config/site.config.example.json`](config/site.config.example.json)).

## Testing

```bash
npm run test:unit   # unit tests (vitest)
npm run test:e2e    # end-to-end tests
npm run test:cov    # coverage
npm run lint        # oxlint
npm run format      # prettier
```
