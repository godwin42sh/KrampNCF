import { stringifyUrl } from "query-string";
import Redis from "ioredis";
import type { IsCached } from "../types/IsCached";
import { PrimData } from "../types/PrimData";
import { PrimSNCF, StopMonitoringDelivery } from "../types/PrimSNCF";

export class Prim {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(apiUrl: string, apiKey: string) {
    this.baseUrl = apiUrl.endsWith("/") ? apiUrl : apiUrl + "/";
    this.headers = {
      apikey: apiKey,
    };
  }

  makeUrlFromPrimData(primData: PrimData): string {
    return stringifyUrl({
      url: this.baseUrl + "stop-monitoring",
      query: {
        MonitoringRef: primData.primDepartureRef,
        LineRef: primData.primLineRef,
      },
    });
  }

  async getDepartures(
    primData: PrimData,
  ): Promise<IsCached<StopMonitoringDelivery[]>> {
    const redis = new Redis(process.env.REDIS_URL as string);

    const url = this.makeUrlFromPrimData(primData);
    const redisKey = url;

    const cached = await redis.get(redisKey);

    if (cached) {
      console.log("using cached result");
      return {
        isCached: true,
        data: JSON.parse(cached),
      };
    } else {
      let resData: StopMonitoringDelivery[] = [];
      console.log("fething from SNCF API", url);

      try {
        const res = await fetch(url, { headers: this.headers });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data: PrimSNCF = await res.json();

        resData = data.Siri.ServiceDelivery.StopMonitoringDelivery;
        redis.set(redisKey, JSON.stringify(resData), "EX", 120);
      } catch (e) {
        console.log(e);
      }
      return {
        isCached: false,
        data: resData,
      };
    }
  }
}
