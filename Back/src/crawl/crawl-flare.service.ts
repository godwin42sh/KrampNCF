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

type BodyFlare = {
  cmd: string;
  url: string;
  maxTimeout: number;
};

type DataType = "Departures" | "Arrivals";

const REGEX_MATCH_JSON = /(?:.*)(\[\{.*])(?:<\/pre>.*)/;

/**
 * Crawler for the SNCF departures endpoint through FlareSolverr.
 *
 * No Hey API client: FlareSolverr does not publish an OpenAPI spec.
 */
@Injectable()
export class CrawlFlareService {
  private readonly logger = new Logger(CrawlFlareService.name);
  private readonly flaresolverrUrl?: string;
  private readonly sncfBaseUrl?: string;
  private readonly cacheTtlSeconds: number;

  constructor(
    config: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.flaresolverrUrl = config.get<string>("FLARE_API_URL");
    this.sncfBaseUrl = config.get<string>("SNCF_CRAWL_FLARE_URL");
    this.cacheTtlSeconds = config.get<number>("REDIS_CRAWL_EXPIRE") ?? 300;
  }

  private ensureConfigured(): { flaresolverrUrl: string; sncfBaseUrl: string } {
    if (!this.flaresolverrUrl || !this.sncfBaseUrl) {
      throw new ServiceUnavailableException(
        "FlareSolverr crawl is not configured (FLARE_API_URL / SNCF_CRAWL_FLARE_URL)",
      );
    }
    return {
      flaresolverrUrl: this.flaresolverrUrl,
      sncfBaseUrl: this.sncfBaseUrl,
    };
  }

  private getJsonFromHtml(html: string): CrawlFlareDeparture[] {
    const match = html.match(REGEX_MATCH_JSON);

    if (match) {
      return JSON.parse(match[1]) as CrawlFlareDeparture[];
    }

    return [];
  }

  private makeBody(
    stationId: string,
    dataType: DataType = "Departures",
  ): BodyFlare {
    const { sncfBaseUrl } = this.ensureConfigured();
    return {
      cmd: "request.get",
      url: `${sncfBaseUrl}/${dataType}/${stationId}`,
      maxTimeout: 60000,
    };
  }

  async getDepartures(
    crawlData: CrawlData,
  ): Promise<IsCached<CrawlFlareDeparture[]>> {
    const { flaresolverrUrl } = this.ensureConfigured();
    const body = this.makeBody(crawlData.flareId);
    const redisKey = `crawlFlare:${body.url}`;

    const cached = await this.cache.getJson<CrawlFlareDeparture[]>(redisKey);

    if (cached) {
      this.logger.debug(`Cache hit ${redisKey} (${cached.length} departures)`);
      return { isCached: true, data: cached };
    }

    let resData: CrawlFlareDeparture[] = [];
    this.logger.debug(
      `Cache miss — crawling ${body.url} through FlareSolverr`,
    );
    const startedAt = Date.now();

    try {
      const res = await fetch(flaresolverrUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = (await res.json()) as { solution: { response: string } };
      resData = this.getJsonFromHtml(data.solution.response);

      this.logger.debug(
        `FlareSolverr returned ${resData.length} departures in ${Date.now() - startedAt}ms`,
      );

      if (!resData.length) {
        this.logger.warn(
          "FlareSolverr response contained no JSON payload (challenge page?)",
        );
      }

      this.cache.setJson(redisKey, resData, this.cacheTtlSeconds);
    } catch (err) {
      this.logger.error(
        `FlareSolverr crawl failed: ${(err as Error).message}`,
      );
    }

    return { isCached: false, data: resData };
  }
}
