# KrampNCF — Optimization Report

_Date: 2026-07-23 · Scope: entire repository (Back/, Scriptable/, Docker, CI)_

## Executive summary

The project is a small, well-organized Bun + Express API that aggregates SNCF departure data from four sources (GTFS-RT, PRIM, HTML crawl, FlareSolverr crawl) with Redis caching, plus iOS Scriptable widgets. The biggest wins, in order of impact:

1. **Reuse a single Redis connection** — a new TCP connection is opened (and never closed) on every cache lookup.
2. **Stop caching the entire national GTFS-RT feed as JSON** — every request re-parses a multi-megabyte blob.
3. **Add async error handling** — most routes will hang the request (Express 4 + async) if a dependency throws.
4. **Fix the Docker build** — the lockfile is never copied into the image (`bun.lockb*` vs actual `bun.lock`), and the `tsc` build step is unnecessary under Bun.
5. **Parallelize independent upstream fetches** in the per-line data functions.

---

## 1. High impact — runtime performance

### 1.1 New Redis connection per call, never closed (critical)

Every service method creates its own client and never calls `.quit()`:

- `Back/src/services/sncf-api.ts:38`
- `Back/src/services/gtfs-api.ts:7`
- `Back/src/services/crawl-api.ts:83`
- `Back/src/services/crawl-flare-api.ts:56`
- `Back/src/services/prim-api.ts:31`

Effects: TCP + handshake latency added to every request, and a connection/file-descriptor leak — `ioredis` connections stay open until the process dies. A burst of requests (e.g. `/departuresCrawlFlare` fans out over all `crawlsData`, and `/departuresPrimByType` over all matching PRIM lines) multiplies this.

**Fix:** one shared module-level client:

```ts
// src/services/redis.ts
import Redis from "ioredis";
export const redis = new Redis(process.env.REDIS_URL as string);
```

Import it everywhere instead of `new Redis(...)`. This is a ~10-line change and removes connection setup from the hot path entirely.

### 1.2 Whole GTFS-RT feed cached as JSON (high)

`readGtfsRT` (`Back/src/services/gtfs-api.ts`) decodes the **entire SNCF TER France** trip-updates feed, `JSON.stringify`s it into Redis, and every subsequent request `JSON.parse`s the full blob — typically several MB — before scanning all entities linearly.

Options, cheapest first:

- **In-process memory cache** with a 60 s TTL (the feed is already refreshed every 60 s). A single process serves this API; Redis round-trip + parse of a huge JSON string is pure overhead. Keep Redis only if you run multiple replicas.
- If Redis must stay: store the **raw protobuf bytes** (`ioredis` supports Buffers) and decode with `FeedMessage.decode`, which is significantly faster than `JSON.parse` on the equivalent JSON, and halves memory churn.
- Best: pre-filter at write time — store only the stop-time updates for the stations in `linesData` (two stations), reducing the cached payload from MBs to KBs.

Minor: `FeedMessage.decode` is synchronous — the `await` on it is a no-op.

### 1.3 Sequential awaits for independent fetches (medium)

In `Back/src/utils/utils.ts`:

- `fetchDataFromLineDataGTFS` awaits SNCF departures → then GTFS-RT feed → then `addDockToTrainResponse` (another crawl HTTP fetch). The GTFS-RT read and crawl fetch don't depend on the SNCF response; start all three with `Promise.all` and merge afterwards. Same pattern in `fetchDataFromLineDataPrim` and `fetchDataFromLineDataCrawlFlare`.
- Worst case today: 3 upstream calls in series ≈ sum of latencies; parallelized ≈ max of latencies.

### 1.4 No request coalescing on cache miss (low, note only)

Concurrent requests that miss the cache all hit SNCF/FlareSolverr simultaneously (cache stampede). For a personal service this is acceptable; if it grows, wrap misses in a per-key in-flight promise map.

### 1.5 SNCF departures cache key granularity (low)

`sncf-api.ts:49` keys on `format(dateFrom, "yyyyMMdd.HH.mm")` with a 120 s TTL. Because the default `dateFrom` is "now minus 1 hour", the key rotates every minute, so the effective cache lifetime is ≤ 60 s, not 120, and each minute writes a new key. Consider truncating to a 2-minute bucket or keying on the line instead.

---

## 2. High impact — correctness & robustness

### 2.1 Unhandled async errors hang requests (high)

Only `/departuresRT` has a try/catch. Express 4 does **not** catch rejected promises from async handlers: if `readGtfsRT`, `getDeparturesFromPrim`, or a crawl throws in any other route (`/departuresRT/:id`, `/departures/…`, `/departuresPrim/…`, `/departuresCrawl*`), the request never gets a response and the client times out; the rejection is logged as unhandled.

**Fix (pick one):**
- Upgrade to Express 5 (async errors forwarded to error middleware automatically), or
- Add a tiny `asyncHandler(fn)` wrapper / a global error middleware, or
- Since you're on Bun anyway: Hono or Elysia handle async natively and are faster than Express (see §4.3).

### 2.2 Missing env-var validation (medium)

Every route does `process.env.X as string`. A missing var produces URLs like `undefined/coverage/fr-idf/` at request time. Validate required vars once at startup and fail fast with a clear message.

### 2.3 `subtractHours` mutates its argument (low)

`Back/src/utils/utils.ts:20` mutates the passed `Date`. Currently only called with fresh dates, but it's a footgun. Return `new Date(date.getTime() - hours * 3600_000)`.

### 2.4 Awtrix midnight edge case (low)

`utilsAwtrix.ts` rebuilds a `Date` from `HH:mm` assuming today; a departure just after midnight computes a large negative `differenceInMinutes` and is silently dropped from the "next hour" window.

---

## 3. Build, image & CI

### 3.1 Lockfile never enters the Docker image (high)

`Back/Dockerfile:6` copies `bun.lockb*`, but the repo's lockfile is the **text-format `bun.lock`** (glob doesn't match — `*` requires trailing chars after `lockb`... it matches `bun.lockb` + anything, not `bun.lock`). So `bun install` in the image resolves dependencies fresh on every build: non-reproducible images and no layer-cache stability.

```dockerfile
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
```

### 3.2 Unnecessary TypeScript compile step (medium)

The image runs `bun run tsc` then `bun run dist/app.js`. Bun executes TypeScript natively — `CMD ["bun", "src/app.ts"]` removes the compile step, the `typescript` install requirement at build time, and the risk of `main`/`start` path drift (note `package.json` `main` says `dist/src/app.js` while `start` runs `dist/app.js` — one of these is stale). If you keep `tsc`, it's only useful as a type-check gate: `bun run tsc --noEmit` in CI is the better place for it.

### 3.3 Image size and pinning (medium)

- `FROM oven/bun:latest` is unpinned — builds can change under you. Pin (e.g. `oven/bun:1.2-slim`) and use the `-slim`/`-alpine` variant; `bun:latest` (Debian) is ~100 MB+ larger.
- Dev dependencies (eslint, typescript, ts-node…) are installed into the final image. `--production` or a multi-stage build cuts most of it.

### 3.4 CI workflow (low)

`.github/workflows/publish-to-docker.yml`:
- QEMU is set up but no `platforms:` are requested — the QEMU step is dead weight (or, if you *meant* to build arm64 for a Pi, it's missing).
- No build cache: add `cache-from: type=gha` / `cache-to: type=gha,mode=max` to the build-push action.
- `actions/checkout@v3` → v4; consider a version tag alongside `:latest`.
- No type-check/lint job runs before publishing — a type error ships silently (the image build would catch `tsc` failures today, but won't if you adopt §3.2; add a `bun run tsc --noEmit` step).

### 3.5 docker-compose (low)

- `version:` and `links:` are obsolete in Compose v2 (`depends_on` + the default network already cover it).
- `redis:7.2.3` is a 2023 image — bump to `redis:7.4-alpine` (or `valkey`), and consider `--maxmemory`/`allkeys-lru` since everything stored has a TTL anyway.

---

## 4. Code quality & dependencies

### 4.1 Duplication in `utils.ts` (medium)

`fetchDataFromLineDataGTFS`, `…Prim`, and `…CrawlFlare` share ~25 identical lines (SNCF fetch, response scaffold, date filter). Extract the common prelude into one helper that returns `{res, departures}` and keep only the source-specific merge in each function. Same for the repeated route boilerplate in `app.ts` — also note `res.json(x)` replaces every `res.setHeader("Content-Type", "application/json"); res.send(JSON.stringify(x))` pair, and `.find()` replaces the `.filter(...)[0]` pattern (`app.ts:134`, `app.ts:238`, `app.ts:257`).

### 4.2 O(n²) accumulation (low)

`utilsPrim.ts:108` — `res = [...res, ...built]` inside a `forEach` re-copies the array each iteration. Use `flatMap`:

```ts
const res = departuresFrom.data.flatMap((d) =>
  buildDepartureFromStops(primData, d.MonitoredStopVisit, trainNumbersFilter));
```

### 4.3 Dependencies (medium)

- **`query-string@7.1.1`** (exact-pinned, 2021): used for one URL in `prim-api.ts`. Native `URLSearchParams` does this — drop the dependency.
- **`date-fns` v2 + `date-fns-tz` v2**: v4 has native timezone support (`@date-fns/tz`) and smaller output. Not urgent, but v2 is EOL.
- **`express` 4**: consider Express 5 (async error handling, §2.1) or a Bun-native router (Hono/Elysia) — measurably lower per-request overhead under Bun and first-class TypeScript.
- **ESLint config mismatch**: `.eslintrc.json` extends `airbnb-base`/`airbnb-typescript`, but `package.json` installs `eslint-config-standard-with-typescript` — the airbnb configs aren't in `devDependencies`, so lint almost certainly fails to run. Also `"env": {"ES2024": true}` is invalid (must be lowercase `es2024`). Since ESLint 8 is EOL, the clean path is flat-config ESLint 9 + `typescript-eslint`.
- **`ts-node`** is unused under Bun — remove.

### 4.4 tsconfig (low)

`target: es2016` / `module: commonjs` is conservative for a Bun-only runtime. `"target": "esnext", "module": "preserve", "moduleResolution": "bundler", "noEmit": true` (with §3.2) matches how the code actually runs. Add explicit `rootDir`/`include` to stop relying on inference.

### 4.5 Logging noise (low)

`utilsFlare.ts:79` logs the full `crawlData` object on every request; `sncf-api.ts` / `prim-api.ts` log "fething from SNCF API" (typo included) per miss. Fine for debugging, but consider a `DEBUG` flag — log lines are the main cost in the request hot path once Redis is shared.

---

## 5. Scriptable widgets (bugs found in passing)

- **`SNCFModule.js:21` `filterOnlyDelays` filters everything out**: the `filter` callback body calls `find` but never `return`s it, so the callback returns `undefined` for every train.
- **`SNCFModule.js:157` hardcodes dock "2"**: `makeTrainDock(scheduleStack, "2")` ignores the real `data.dock` value — every train displays platform 2.
- **`SNCFModule.js:91` implicit globals**: `[timeText, color] = getTimeTextAndColor(data)` without `const` leaks globals (and `color` in `makeTrainTime` likewise).

---

## Suggested order of attack

| # | Change | Effort | Impact |
|---|--------|--------|--------|
| 1 | Shared Redis client (§1.1) | XS | High — latency + leak fix |
| 2 | Async error middleware or Express 5 (§2.1) | S | High — no more hung requests |
| 3 | Dockerfile: correct lockfile, `--production`, drop tsc, pin base (§3.1–3.3) | S | High — reproducible, smaller, faster builds |
| 4 | GTFS-RT cache: in-memory or protobuf bytes, pre-filter (§1.2) | M | High — biggest per-request CPU win |
| 5 | Parallelize upstream fetches (§1.3) | S | Medium — latency |
| 6 | Fix Scriptable dock + filter bugs (§5) | XS | Medium — user-visible bugs |
| 7 | Dedupe `fetchDataFromLineData*`, `res.json`, `flatMap` (§4.1–4.2) | M | Medium — maintainability |
| 8 | Deps cleanup: query-string, ts-node, ESLint config, date-fns (§4.3) | M | Low–medium |
| 9 | CI cache + type-check gate, compose modernization (§3.4–3.5) | S | Low |
