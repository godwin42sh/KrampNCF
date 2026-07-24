import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { format } from "date-fns";

import { CacheService } from "../redis/cache.service";
import type { Departure } from "../types/Departure";
import type { IsCached } from "../types/IsCached";
import type { LineDataFilters } from "../types/LineData";

const CACHE_TTL_SECONDS = 120;

/**
 * Client for the SNCF Navitia API (api.sncf.com).
 *
 * Hand-written: none of the upstream APIs used by this project publish a
 * reachable OpenAPI spec (Navitia's /v1/schema endpoint is aggressively
 * rate-limited; PRIM and FlareSolverr publish none).
 */
@Injectable()
export class SncfService {
  private readonly logger = new Logger(SncfService.name);
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(
    config: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.baseUrl = `${config.getOrThrow<string>("SNCF_API_URL")}/coverage/fr-idf/`;
    this.headers = {
      Authorization: `Basic ${config.getOrThrow<string>("SNCF_API_KEY")}`,
    };
  }

  /**
   * The cache key buckets `dateFrom` to 2 minutes so the key does not
   * rotate every minute under the TTL (§1.5 of the optimization report).
   */
  private static cacheBucket(dateFrom: Date): string {
    const bucket = new Date(dateFrom);
    bucket.setMinutes(bucket.getMinutes() - (bucket.getMinutes() % 2), 0, 0);
    return format(bucket, "yyyyMMdd.HH.mm");
  }

  async getDepartures(
    stationId: string,
    dateFrom: Date,
    filters?: LineDataFilters,
  ): Promise<IsCached<Departure[]>> {
    let additionalParams = "";

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        additionalParams += `/${key}/${value}`;
      }
    }

    const url = `stop_areas/${stationId}${additionalParams}/departures?from_datetime=${dateFrom.toISOString()}`;
    const redisKey = `sncf:${stationId}${additionalParams}/departures/${SncfService.cacheBucket(dateFrom)}`;

    const cached = await this.cache.getJson<Departure[]>(redisKey);

    if (cached) {
      this.logger.debug(
        `Cache hit ${redisKey} (${cached.length} departures)`,
      );
      if (!cached.length) {
        this.logger.warn(`Cached SNCF result is empty for ${redisKey}`);
      }
      return { isCached: true, data: cached };
    }

    let resData: Departure[] = [];
    this.logger.debug(`Cache miss ${redisKey} — fetching ${url}`);
    const startedAt = Date.now();

    try {
      const res = await fetch(this.baseUrl + url, { headers: this.headers });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = (await res.json()) as { departures: Departure[] };
      resData = data.departures ?? [];
      this.logger.debug(
        `SNCF API returned ${resData.length} departures in ${Date.now() - startedAt}ms`,
      );
      this.cache.setJson(redisKey, resData, CACHE_TTL_SECONDS);
    } catch (err) {
      this.logger.error(`SNCF API fetch failed: ${(err as Error).message}`);
    }

    if (!resData.length) {
      this.logger.warn(`SNCF API returned no departures for ${url}`);
    }

    return { isCached: false, data: resData };
  }
}
