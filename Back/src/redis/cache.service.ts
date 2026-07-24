import {
  Injectable,
  Logger,
  OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

/**
 * Single shared Redis connection for the whole app (§1.1 of the optimization
 * report — the previous code opened a new connection per cache lookup and
 * never closed it).
 *
 * Cache failures are non-fatal: a Redis outage degrades to "no cache",
 * never to a failing API response.
 */
@Injectable()
export class CacheService implements OnApplicationShutdown {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis(config.getOrThrow<string>("REDIS_URL"), {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 500, 10_000),
    });
    this.redis.on("error", (err) =>
      this.logger.warn(
        `Redis error: ${err.message || (err as NodeJS.ErrnoException).code || String(err)}`,
      ),
    );
  }

  onApplicationShutdown() {
    this.redis.disconnect();
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      return cached ? (JSON.parse(cached) as T) : null;
    } catch (err) {
      this.logger.warn(`Cache read failed for ${key}: ${(err as Error).message}`);
      return null;
    }
  }

  setJson(key: string, value: unknown, ttlSeconds: number): void {
    this.redis
      .set(key, JSON.stringify(value), "EX", ttlSeconds)
      .catch((err: Error) =>
        this.logger.warn(`Cache write failed for ${key}: ${err.message}`),
      );
  }

  async getBuffer(key: string): Promise<Buffer | null> {
    try {
      return await this.redis.getBuffer(key);
    } catch (err) {
      this.logger.warn(`Cache read failed for ${key}: ${(err as Error).message}`);
      return null;
    }
  }

  setBuffer(key: string, value: Buffer, ttlSeconds: number): void {
    this.redis
      .set(key, value, "EX", ttlSeconds)
      .catch((err: Error) =>
        this.logger.warn(`Cache write failed for ${key}: ${err.message}`),
      );
  }
}
