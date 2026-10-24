import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { CacheService } from "../redis/cache.service";
import type { CrawlData } from "../types/CrawlData";
import type { CrawlFlareDeparture } from "../types/CrawlFlareDeparture";
import type { IsCached } from "../types/IsCached";

type DataType = "Departures" | "Arrivals";

// At most one upstream request per cache window; the TTL is randomized so
// the traffic pattern looks organic rather than a fixed-interval poller.
const CACHE_TTL_MIN_SECONDS = 4 * 60;
const CACHE_TTL_MAX_SECONDS = 6 * 60;

// Failures stick only briefly so the next call retries soon instead of
// blanking the source for a whole cache window.
const ERROR_CACHE_TTL_SECONDS = 30;

// Circuit breaker: after this many consecutive failures (empty results are
// not failures), stop crawling for a few hours.
const MAX_CONSECUTIVE_FAILURES = 5;
const FAILURE_COOLDOWN_SECONDS = 3 * 3600;
const FAILURE_COUNT_TTL_SECONDS = 24 * 3600;
const FAILURE_COUNT_KEY = "crawlFlare:failures";
const COOLDOWN_KEY = "crawlFlare:cooldown";

// Only crawl while trains run (Paris local time).
const PARIS_OPEN_HOUR = 7;
const PARIS_CLOSE_HOUR = 22;

function parisHour(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      hour12: false,
    }).format(date),
  );
}

function randomTtlSeconds(): number {
  return (
    CACHE_TTL_MIN_SECONDS +
    Math.floor(
      Math.random() * (CACHE_TTL_MAX_SECONDS - CACHE_TTL_MIN_SECONDS + 1),
    )
  );
}

/**
 * Crawler for the SNCF station departure boards.
 *
 * Historically went through FlareSolverr ("Flare") to get past bot
 * protection, until DataDome started blocking FlareSolverr's headless
 * browser. The schedule-table JSON answers plain HTTP GETs unchallenged,
 * so this now fetches it directly. The service and route names keep
 * "CrawlFlare" to avoid breaking the public API.
 */
@Injectable()
export class CrawlFlareService {
  private readonly logger = new Logger(CrawlFlareService.name);
  private readonly sncfBaseUrl?: string;

  constructor(
    config: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.sncfBaseUrl = config.get<string>("SNCF_CRAWL_FLARE_URL");
  }

  private makeUrl(stationId: string, dataType: DataType = "Departures") {
    if (!this.sncfBaseUrl) {
      throw new ServiceUnavailableException(
        "Schedule-table crawl is not configured (SNCF_CRAWL_FLARE_URL)",
      );
    }
    return `${this.sncfBaseUrl}/${dataType}/${stationId}`;
  }

  async getDepartures(
    crawlData: CrawlData,
  ): Promise<IsCached<CrawlFlareDeparture[]>> {
    const url = this.makeUrl(crawlData.flareId);
    const redisKey = `crawlFlare:${url}`;

    const cached = await this.cache.getJson<CrawlFlareDeparture[]>(redisKey);

    if (cached) {
      this.logger.debug(`Cache hit ${redisKey} (${cached.length} departures)`);
      if (!cached.length) {
        this.logger.warn(`Cached schedule-table result is empty for ${redisKey}`);
      }
      return { isCached: true, data: cached };
    }

    const hour = parisHour(new Date());
    if (hour < PARIS_OPEN_HOUR || hour >= PARIS_CLOSE_HOUR) {
      this.logger.debug(
        `Outside service hours (${hour}h Paris) — skipping crawl of ${url}`,
      );
      return { isCached: false, data: [] };
    }

    if (await this.cache.getJson(COOLDOWN_KEY)) {
      this.logger.debug(
        `Crawl paused after repeated failures — skipping ${url}`,
      );
      return { isCached: false, data: [] };
    }

    let resData: CrawlFlareDeparture[] = [];
    let failed = false;
    this.logger.debug(`Cache miss — fetching ${url}`);
    const startedAt = Date.now();

    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      resData = (await res.json()) as CrawlFlareDeparture[];

      this.logger.debug(
        `Schedule-table returned ${resData.length} departures in ${Date.now() - startedAt}ms`,
      );
    } catch (err) {
      failed = true;
      this.logger.error(
        `Schedule-table crawl failed: ${(err as Error).message}`,
      );
    }

    // Every outcome is cached so the endpoint is hit at most once per
    // window; failures get the short TTL to allow a quick retry.
    this.cache.setJson(
      redisKey,
      resData,
      failed ? ERROR_CACHE_TTL_SECONDS : randomTtlSeconds(),
    );

    if (failed) {
      const failures =
        ((await this.cache.getJson<number>(FAILURE_COUNT_KEY)) ?? 0) + 1;
      if (failures >= MAX_CONSECUTIVE_FAILURES) {
        this.logger.warn(
          `${failures} consecutive crawl failures — pausing crawls for ${FAILURE_COOLDOWN_SECONDS / 3600}h`,
        );
        this.cache.setJson(COOLDOWN_KEY, true, FAILURE_COOLDOWN_SECONDS);
        this.cache.setJson(FAILURE_COUNT_KEY, 0, FAILURE_COUNT_TTL_SECONDS);
      } else {
        this.cache.setJson(
          FAILURE_COUNT_KEY,
          failures,
          FAILURE_COUNT_TTL_SECONDS,
        );
      }
    } else {
      this.cache.setJson(FAILURE_COUNT_KEY, 0, FAILURE_COUNT_TTL_SECONDS);
    }

    return { isCached: false, data: resData };
  }
}
