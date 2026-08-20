# KrampNCF

A small [NestJS](https://nestjs.com) API (running on [Bun](https://bun.sh)) that
aggregates SNCF / Île-de-France train departures for the **Paris-Austerlitz ↔
Étampes** line and serves them to an iOS [Scriptable](https://scriptable.app)
widget and an [Awtrix](https://blueforcer.github.io/awtrix3/) LED matrix clock.

It merges scheduled timetables with realtime sources (delays and platforms),
caches upstream responses in Redis, and documents itself with Swagger.

## Data sources

| Source | Role | Status |
|--------|------|--------|
| **SIRI ET Lite** (national, transport.data.gouv.fr proxy) | Realtime departures with delay + platform, RER C **and** mainline Rémi, full calling pattern | ✅ **Recommended** |
| **PRIM** (Île-de-France Mobilités SIRI Lite) | Realtime departures: time, delay, platform — RER C + partial TER | ✅ Working |
| **GTFS-RT** (transport.data.gouv.fr proxy) | Realtime trip updates | ✅ Working |
| **Navitia** (`api.sncf.com`) | Scheduled timetables (enriched by a realtime source) | ⚠️ Needs a valid API key |
| **ter.sncf.com crawl** (direct + via FlareSolverr) | Legacy platform/departure scraper | ❌ Blocked by DataDome |

**SIRI ET Lite** is the best source: keyless, national, and it carries the full
calling list per train — so it covers both the RER C shuttle and the mainline
Rémi (e.g. Paris-Austerlitz → Orléans calling at Étampes) that PRIM's IDFM feed
doesn't publish, and it can tell definitively whether a train stops at Étampes.
Its feed is a ~15 MB national XML fetched-and-cached like GTFS-RT.

PRIM stays as a lighter IDFM-only source. The `crawlFlare` source is kept for
reference but no longer works — SNCF put `garesetconnexions.sncf` behind
DataDome, which FlareSolverr cannot pass.

## Quick start

```bash
bun install
bun run dev      # watch mode
```

The API listens on `PORT` (default `80`). Interactive docs: **`/docs`**
(Swagger UI), raw spec: **`/docs-json`**.

To generate the spec offline (writes `openapi.json` and `swagger.json` to
this directory, no server or env vars needed):

```bash
bun run openapi
```

With Docker (from the repo root):

```bash
docker compose up -d --build
```

## Endpoints

All responses are JSON. A `DeparturesResponse` is `{ title, data: TrainResponse[],
fetchType, isCached }`; a `TrainResponse` carries `departureTime`, optional
`arrivalTime`, `delay` (minutes), `dock` (platform), `trainNumber`, `trainType`,
and `deleted`.

Every route accepts `?format=awtrix` to get Awtrix frame(s) instead of JSON
boards (list routes return one frame per board). Routes returning several
boards also accept `?from=<station>` to keep only the board departing from
that station — case- and accent-insensitive, e.g. `?from=etampes` or
`?from=austerlitz` (`404` when nothing matches).

| Method & path | Description |
|---------------|-------------|
| `GET /departuresSiri/:id` | **Recommended.** Realtime SIRI ET departures for a board (delay + dock, RER C + Rémi). |
| `GET /departuresSiriByType/:type` | SIRI ET departures for every board of a given `type` (e.g. `train`). |
| `GET /departuresPrim/:id` | Realtime PRIM departures for a configured board (time + delay + dock). |
| `GET /departuresPrimByType/:type` | PRIM departures for every board of a given `type` (e.g. `train`). |
| `GET /departuresRT` | GTFS-RT realtime for both directions. |
| `GET /departuresRT/:id` | GTFS-RT realtime for one line. |
| `GET /departures` | Scheduled (Navitia) departures for all lines, merged with the default realtime source. |
| `GET /departures/:id/:typeFetch?` | Scheduled departures for one line; `typeFetch` ∈ `gtfs \| prim \| crawlFlare` overrides the source. |
| `GET /departuresCrawl/:id` | Legacy ter.sncf.com scrape (see status above). |
| `GET /departuresCrawlFlare` · `/departuresCrawlFlare/:id` | Legacy FlareSolverr scrape (blocked by DataDome). |

Errors use standard HTTP codes: `400` (bad `dateFrom`/query), `404` (unknown
id / no departures), `503` (a required upstream is unconfigured or unreachable).

## Configuration

Environment variables are validated at boot (with [zod](https://zod.dev)); a
missing **required** variable stops startup with a clear message. For Docker,
copy the repo-root `.env.example` to `.env` — Compose reads it automatically.

**Required**

| Variable | Description |
|----------|-------------|
| `REDIS_URL` | Redis connection URL |
| `SNCF_API_URL` | Navitia base URL (`https://api.sncf.com/v1`) |
| `SNCF_API_KEY` | Navitia API key (Basic auth) |
| `SNCF_GTFSRT_URL` | GTFS-RT trip-updates feed URL |

**Optional** — a feature's endpoints return `503` when its variables are unset.

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port (default `80`) |
| `SNCF_API_PRIM_URL`, `SNCF_API_PRIM_KEY` | PRIM SIRI Lite base URL + key |
| `SNCF_CRAWL_URL` | ter.sncf.com base URL (legacy crawl) |
| `FLARE_API_URL`, `SNCF_CRAWL_FLARE_URL` | FlareSolverr endpoint + SNCF base (legacy) |
| `REDIS_CRAWL_EXPIRE` | Crawl cache TTL in seconds (default `300`) |
| `DEFAULT_FETCH_RT_METHOD` | `prim` (default) \| `gtfs` \| `crawlFlare` |
| `AWTRIX_ICON_TER`, `AWTRIX_ICON_RER` | Awtrix icon ids |
| `LOG_LEVEL` | `error` \| `warn` \| `log` \| `debug` (default) \| `verbose` |

## How the boards are configured

Lines and stops live in [`src/config`](src/config). Each PRIM board
([`prim-data.ts`](src/config/prim-data.ts)) needs:

- `primDepartureRef` — a **StopArea** SIRI reference (`STIF:StopArea:SP:<id>:`).
  Train realtime is only served at the StopArea level, not per quay. Find the id
  in IDFM's `zones-d-arrets` open dataset (the `railStation` row). Étampes is
  `43080`, Paris-Austerlitz is `43072`.
- `destinationMatch` — the destination names to keep (direction filter). A
  terminus like Austerlitz lists every outbound direction, so this narrows it to
  the trains heading toward Étampes.
- `primLineRefs` *(optional)* — restrict to specific lines; omit to keep both
  RER C (`C01727`) and TER (`C01857`).

> Note: PRIM only covers stops **inside** Île-de-France. Étampes and
> Paris-Austerlitz are in scope; Orléans is not, so departures beyond the IDF
> boundary are unavailable.

## Architecture

```
src/
  main.ts                 bootstrap, Swagger, global zod validation pipe
  app.module.ts           config (env validation) + HTTP request logging
  config/                 env schema + line / prim / crawl board definitions
  redis/                  single shared ioredis client (CacheService)
  sncf/  gtfs/  prim/  crawl/   upstream clients (one injectable service each)
  departures/             controller + orchestration service + pure parsers + DTOs
```

Design notes: one shared Redis connection for the whole app; the GTFS-RT feed is
cached as raw protobuf bytes plus a short in-process memory cache; independent
upstream calls run in parallel; empty crawl results are cached only briefly so a
transient upstream failure doesn't blank the API.

## Development

```bash
bun run typecheck    # tsc --noEmit
bun run lint         # eslint
bun run test         # bun test (specs live next to the code as *.spec.ts)
```

CI (`.github/workflows`) runs typecheck, lint, and tests before building and
publishing the Docker image.
