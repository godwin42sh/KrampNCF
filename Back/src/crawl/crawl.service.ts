import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HTMLElement, parse } from "node-html-parser";

import { CacheService } from "../redis/cache.service";
import type { CrawlRes } from "../types/CrawlRes";
import type { IsCached } from "../types/IsCached";
import type { LineData } from "../types/LineData";

const EMPTY_CACHE_TTL_SECONDS = 30;

/** Crawler for the ter.sncf.com departures page (dock/platform info). */
@Injectable()
export class CrawlService {
  private readonly logger = new Logger(CrawlService.name);
  private readonly baseUrl?: string;
  private readonly cacheTtlSeconds: number;

  private readonly titleDepartureCorresp = new Map<string, keyof CrawlRes>([
    ["Voie", "dock"],
    ["Mode", "trainNumber"],
    ["Départ", "departureTime"],
  ]);

  private readonly headers: Record<string, string> = {
    Host: "www.ter.sncf.com",
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    DNT: "1",
    "Alt-Used": "www.ter.sncf.com",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "cross-site",
    Pragma: "no-cache",
    "Cache-Control": "no-cache",
  };

  constructor(
    config: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.baseUrl = config.get<string>("SNCF_CRAWL_URL");
    this.cacheTtlSeconds = config.get<number>("REDIS_CRAWL_EXPIRE") ?? 300;
  }

  get isConfigured(): boolean {
    return !!this.baseUrl;
  }

  parseParaGraphsFromHtml(paragraphs: HTMLElement[]): CrawlRes {
    const tmp: CrawlRes = {
      dock: "",
      trainNumber: "",
      departureTime: "",
    };

    paragraphs.forEach((paragraph) => {
      const title = paragraph.querySelector(".sr-only");

      if (!title) return;

      const titleKey = this.titleDepartureCorresp.get(title.text);

      if (!titleKey) return;

      title.remove();

      if (titleKey === "trainNumber") {
        const trainNumber = paragraph.text.split(" ").at(-1);
        tmp[titleKey] = trainNumber ?? paragraph.text;
      } else {
        tmp[titleKey] = paragraph.text;
      }
    });

    return tmp;
  }

  parseDeparturesFromHtml(html: string): CrawlRes[] {
    const root = parse(html);

    return root
      .querySelectorAll(".MuiAccordion-root")
      .map((accordionElement) =>
        this.parseParaGraphsFromHtml(accordionElement.querySelectorAll("p")),
      );
  }

  async getDepartures(lineData: LineData): Promise<IsCached<CrawlRes[]>> {
    if (!this.baseUrl) {
      throw new ServiceUnavailableException(
        "TER crawl is not configured (SNCF_CRAWL_URL)",
      );
    }

    const url = `/${lineData.crawlUrlParam}`;
    const redisKey = `crawl:${url}`;

    const cached = await this.cache.getJson<CrawlRes[]>(redisKey);

    if (cached) {
      this.logger.debug(`Cache hit ${redisKey} (${cached.length} rows)`);
      if (!cached.length) {
        this.logger.warn(`Cached crawl result is empty for ${redisKey}`);
      }
      return { isCached: true, data: cached };
    }

    let resData: CrawlRes[] = [];
    this.logger.debug(`Cache miss — crawling SNCF schedule ${url}`);
    const startedAt = Date.now();

    try {
      const res = await fetch(this.baseUrl + url, { headers: this.headers });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      resData = this.parseDeparturesFromHtml(await res.text());
      this.logger.debug(
        `Crawl parsed ${resData.length} rows in ${Date.now() - startedAt}ms`,
      );
      // Empty results only stick for a short time (see crawl-flare.service).
      this.cache.setJson(
        redisKey,
        resData,
        resData.length ? this.cacheTtlSeconds : EMPTY_CACHE_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.error(`Crawl failed: ${(err as Error).message}`);
    }

    if (!resData.length) {
      this.logger.warn(
        `Crawl returned no departures for ${url} (page layout change?)`,
      );
    }

    return { isCached: false, data: resData };
  }

  /**
   * Best-effort variant used for dock enrichment: returns an empty list when
   * the crawler is not configured or fails, instead of throwing.
   */
  async getDeparturesSafe(lineData: LineData): Promise<CrawlRes[]> {
    if (!this.baseUrl) {
      return [];
    }

    try {
      return (await this.getDepartures(lineData)).data;
    } catch {
      return [];
    }
  }
}
