import axios, { AxiosInstance } from "axios";
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
  private api: AxiosInstance;

  private sncfUrl: string;

  private regexMatchJson = /(?:.*)(\[\{.*])(?:<\/pre>.*)/;

  constructor(
    flaresolverrUrl: string,
    apiUrl: string,
    dataType: DataType = "Departures",
  ) {
    this.sncfUrl = `${apiUrl}/${dataType}`;
    this.api = axios.create({
      baseURL: flaresolverrUrl,
      headers: {
        "Content-Type": "application/json",
      },
    });
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

    const cached = await redis.get(redisKey);
    const cacheTime = process.env.REDIS_CRAWL_EXPIRE
      ? parseInt(process.env.REDIS_CRAWL_EXPIRE)
      : 300;

    if (cached) {
      return {
        isCached: true,
        data: JSON.parse(cached),
      };
    } else {
      let resData: CrawlFlareDeparture[] = [];
      console.log("crawling from SNCF site with flaresolverr");

      try {
        const { data } = await this.api.post("", body);

        const resData = data.solution.response;
        redis.set(redisKey, JSON.stringify(resData), "EX", cacheTime);
      } catch (e) {
        console.log("error", e);
        if (axios.isAxiosError(e)) {
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
