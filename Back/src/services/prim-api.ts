import { stringifyUrl } from "query-string";
import axios, { AxiosInstance } from "axios";
import { format } from "date-fns";
import Redis from "ioredis";

import type { IsCached } from "../types/IsCached";
import { PrimData } from "../types/PrimData";
import { PrimSNCF, StopMonitoringDelivery } from "../types/PrimSNCF";

export class Prim {

  private api: AxiosInstance;

  constructor(apiUrl: string, apiKey: string) {
    console.log('prim api url', apiUrl);
    this.api = axios.create({
      baseURL: apiUrl,
      headers: {
        apikey: apiKey,
      },
    });
  }

  makeUrlFromPrimData(primData: PrimData): string {
    return stringifyUrl({
      url: 'stop-monitoring',
      query: {
        MonitoringRef: primData.primDepartureRef,
        LineRef: primData.primLineRef,
      },
    });
  }

  async getDepartures(primData: PrimData): Promise<IsCached<StopMonitoringDelivery[]>> {

    const redis = new Redis((process.env.REDIS_URL as string));

    const url = this.makeUrlFromPrimData(primData);
    const redisKey = url;

    const cached = await redis.get(redisKey);

    if (cached) {
      console.log('using cached result');
      return {
        isCached: true,
        data: JSON.parse(cached),
      };
    }
    else {
      let resData: StopMonitoringDelivery[] = [];
      console.log('fething from SNCF API', url);

      try {
        const { data } = await this.api.get<PrimSNCF>(url);
        resData = data.Siri.ServiceDelivery.StopMonitoringDelivery;
        redis.set(redisKey, JSON.stringify(resData), 'EX', 120);
      }
      catch (e) {
        console.log(e);
      }
      return {
        isCached: false,
        data: resData,
      };
    }
  }
}