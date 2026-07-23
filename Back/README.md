# krampncf

SNCF departures aggregation API built with [NestJS](https://nestjs.com) running on [Bun](https://bun.sh).

It merges Navitia scheduled data with realtime sources (GTFS-RT, PRIM SIRI Lite, ter.sncf.com crawls) and caches upstream responses in Redis.

## Install

```bash
bun install
```

## Run

```bash
bun run dev    # watch mode
bun run start  # production
```

API documentation (Swagger UI) is served at `/docs`, the OpenAPI spec at `/docs-json`.

## Checks

```bash
bun run typecheck
bun run lint
bun run test
```

Tests use Bun's built-in runner; specs live next to the code as `*.spec.ts`.

## Environment variables

Required (the app fails fast at boot when missing):

| Variable | Description |
|----------|-------------|
| `REDIS_URL` | Redis connection URL |
| `SNCF_API_URL` | Navitia base URL (e.g. `https://api.sncf.com/v1`) |
| `SNCF_API_KEY` | Navitia API key |
| `SNCF_GTFSRT_URL` | GTFS-RT trip-updates feed URL |

Optional (endpoints depending on them return 503 when unset): `SNCF_API_PRIM_URL`, `SNCF_API_PRIM_KEY`, `SNCF_CRAWL_URL`, `FLARE_API_URL`, `SNCF_CRAWL_FLARE_URL`, `REDIS_CRAWL_EXPIRE`, `DEFAULT_FETCH_RT_METHOD` (`gtfs` | `prim` | `crawlFlare`), `AWTRIX_ICON_TER`, `AWTRIX_ICON_RER`, `PORT`.
