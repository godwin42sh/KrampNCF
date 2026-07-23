import type { CacheService } from "../redis/cache.service";

/** In-memory stand-in for CacheService used by unit tests. */
export class FakeCacheService {
  private readonly json = new Map<string, string>();
  private readonly buffers = new Map<string, Buffer>();

  readonly jsonWrites: { key: string; ttlSeconds: number }[] = [];

  async getJson<T>(key: string): Promise<T | null> {
    const value = this.json.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  setJson(key: string, value: unknown, ttlSeconds: number): void {
    this.jsonWrites.push({ key, ttlSeconds });
    this.json.set(key, JSON.stringify(value));
  }

  async getBuffer(key: string): Promise<Buffer | null> {
    return this.buffers.get(key) ?? null;
  }

  setBuffer(key: string, value: Buffer, _ttlSeconds: number): void {
    this.buffers.set(key, value);
  }

  asCacheService(): CacheService {
    return this as unknown as CacheService;
  }
}

export type FetchStub = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const originalFetch = globalThis.fetch;

/** Replace globalThis.fetch and record calls. Call restoreFetch() after each test. */
export function stubFetch(handler: FetchStub): { calls: string[] } {
  const calls: string[] = [];

  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push(String(input));
    return handler(input, init);
  }) as typeof fetch;

  return { calls };
}

export function restoreFetch(): void {
  globalThis.fetch = originalFetch;
}
