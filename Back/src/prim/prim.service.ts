import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { CacheService } from "../redis/cache.service";
import type { IsCached } from "../types/IsCached";
import type { PrimData } from "../types/PrimData";
import type { PrimSNCF, StopMonitoringDelivery } from "../types/PrimSNCF";

const CACHE_TTL_SECONDS = 120;

/**
 * Client for the Île-de-France Mobilités PRIM SIRI Lite stop-monitoring API.
 *
 * No Hey API client here: PRIM does not publish a public OpenAPI spec (the
 * portal is Cloudflare-gated), so the client stays hand-written.
 */
@Injectable()
export class PrimService {
  private readonly logger = new Logger(PrimService.name);
  private readonly baseUrl?: string;
  private readonly apiKey?: string;

  constructor(
    config: ConfigService,
    private readonly cache: CacheService,
  ) {
    const url = config.get<string>("SNCF_API_PRIM_URL");
    this.baseUrl = url ? (url.endsWith("/") ? url : `${url}/`) : undefined;
    this.apiKey = config.get<string>("SNCF_API_PRIM_KEY");
  }

  private ensureConfigured(): { baseUrl: string; apiKey: string } {
    if (!this.baseUrl || !this.apiKey) {
      throw new ServiceUnavailableException(
        "PRIM API is not configured (SNCF_API_PRIM_URL / SNCF_API_PRIM_KEY)",
      );
    }
    return { baseUrl: this.baseUrl, apiKey: this.apiKey };
  }

  makeUrlFromPrimData(primData: PrimData): string {
    const { baseUrl } = this.ensureConfigured();
    // Only MonitoringRef: passing LineRef makes PRIM reject the request with
    // 400 "Le couple MonitoringRef/LineRef n'existe pas" for these stops, so
    // line filtering is done client-side instead.
    const query = new URLSearchParams({
      MonitoringRef: primData.primDepartureRef,
    });
    return `${baseUrl}stop-monitoring?${query.toString()}`;
  }

  async getDepartures(
    primData: PrimData,
  ): Promise<IsCached<StopMonitoringDelivery[]>> {
    const { apiKey } = this.ensureConfigured();
    const url = this.makeUrlFromPrimData(primData);
    const redisKey = `prim:${url}`;

    const cached = await this.cache.getJson<StopMonitoringDelivery[]>(redisKey);

    if (cached) {
      this.logger.debug(`Cache hit ${redisKey} (${cached.length} deliveries)`);
      if (!cached.length) {
        this.logger.warn(`Cached PRIM result is empty for ${redisKey}`);
      }
      return { isCached: true, data: cached };
    }

    let resData: StopMonitoringDelivery[] = [];
    this.logger.debug(`Cache miss — fetching ${url}`);
    const startedAt = Date.now();

    try {
      const res = await fetch(url, { headers: { apikey: apiKey } });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = (await res.json()) as PrimSNCF;

      resData = data.Siri.ServiceDelivery.StopMonitoringDelivery;
      this.logger.debug(
        `PRIM API returned ${resData.length} deliveries in ${Date.now() - startedAt}ms`,
      );
      this.cache.setJson(redisKey, resData, CACHE_TTL_SECONDS);
    } catch (err) {
      this.logger.error(`PRIM API fetch failed: ${(err as Error).message}`);
    }

    if (!resData.length) {
      this.logger.warn(`PRIM API returned no deliveries for ${url}`);
    }

    return { isCached: false, data: resData };
  }
}
