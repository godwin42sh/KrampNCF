import Redis from "ioredis";

import type { IsCached } from "../types/IsCached";
import { CrawlFlareDeparture } from "src/types/CrawlFlareDeparture";
import { CrawlData } from "src/types/CrawlData";

type BodyFlare = {
  cmd: string;
  url: string;
  maxTimeout: number;
};

type DataType = "Departures" | "Arrivals";

export class CrawlFlare {
  private flaresolverrUrl: string;
  private sncfUrl: string;
  private headers: Record<string, string>;
  private regexMatchJson = /(?:.*)(\[\{.*])(?:<\/pre>.*)/;

  constructor(
    flaresolverrUrl: string,
    apiUrl: string,
    dataType: DataType = "Departures",
  ) {
    this.flaresolverrUrl = flaresolverrUrl;
    this.sncfUrl = `${apiUrl}/${dataType}`;
    this.headers = {
      "Content-Type": "application/json",
    };
  }

  private getJsonFromHtml(html: string): CrawlFlareDeparture[] {
    const match = html.match(this.regexMatchJson);

    if (match) {
      const parsed = JSON.parse(match[1]) as CrawlFlareDeparture[];

      return parsed;
    }

    return [];
  }

  private makeBody(stationId: string): BodyFlare {
    return {
      cmd: "request.get",
      url: `${this.sncfUrl}/${stationId}`,
      maxTimeout: 60000,
    };
  }

  async getDepartures(
    crawlData: CrawlData,
  ): Promise<IsCached<CrawlFlareDeparture[]>> {
    const redis = new Redis(process.env.REDIS_URL as string);

    const body = this.makeBody(crawlData.flareId);
    const redisKey = body.url;
    const cacheTime = process.env.REDIS_CRAWL_EXPIRE
      ? parseInt(process.env.REDIS_CRAWL_EXPIRE)
      : 300;

    const cached = await redis.get(redisKey);

    if (cached) {
      return {
        isCached: true,
        data: JSON.parse(cached),
      };
    } else {
      let resData: CrawlFlareDeparture[] = [];
      console.log("crawling from SNCF site with flaresolverr");

      try {
        const res = await fetch(this.flaresolverrUrl, {
          method: "POST",
          headers: this.headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();
        resData = this.getJsonFromHtml(data.solution.response);

        redis.set(redisKey, JSON.stringify(resData), "EX", cacheTime);
      } catch (e: any) {
        console.log("error", e);
        if (e instanceof Error) {
          console.log("error while crawling", e.message);
        }
      }

      return {
        isCached: false,
        data: resData,
      };
    }
  }
}
