import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

import { CacheService } from "../redis/cache.service";
import type { IsCached } from "../types/IsCached";

export type FeedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage;

const REDIS_KEY = "gtfsRT:pb";
const TTL_SECONDS = 60;
const MEM_TTL_MS = 60_000;

/**
 * GTFS-RT feed reader.
 *
 * Optimization (§1.2 of the report): the previous implementation cached the
 * whole national feed as a JSON string in Redis and re-parsed multiple MB on
 * every request. This version:
 *  - keeps the decoded feed in process memory for 60 s (zero parse cost on
 *    the hot path);
 *  - stores the raw protobuf bytes (not JSON) in Redis so multiple replicas
 *    can still share one upstream fetch — protobuf decode is much cheaper
 *    than JSON.parse of the equivalent payload.
 */
@Injectable()
export class GtfsService {
  private readonly logger = new Logger(GtfsService.name);
  private readonly url: string;

  private memCache?: { feed: FeedMessage; fetchedAt: number };

  constructor(
    config: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.url = config.getOrThrow<string>("SNCF_GTFSRT_URL");
  }

  async getFeed(): Promise<IsCached<FeedMessage> | null> {
    if (this.memCache && Date.now() - this.memCache.fetchedAt < MEM_TTL_MS) {
      return { isCached: true, data: this.memCache.feed };
    }

    const cachedBytes = await this.cache.getBuffer(REDIS_KEY);

    if (cachedBytes) {
      const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
        new Uint8Array(cachedBytes),
      );
      this.memCache = { feed, fetchedAt: Date.now() };
      return { isCached: true, data: feed };
    }

    try {
      const res = await fetch(this.url);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      const feed =
        GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(bytes);

      this.cache.setBuffer(REDIS_KEY, Buffer.from(bytes), TTL_SECONDS);
      this.memCache = { feed, fetchedAt: Date.now() };

      return { isCached: false, data: feed };
    } catch (err) {
      this.logger.error(`GTFS-RT fetch failed: ${(err as Error).message}`);
      return null;
    }
  }
}
