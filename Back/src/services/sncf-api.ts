import { format } from "date-fns";
import Redis from "ioredis";

import type { Departure } from "../types/Departure";
import type { IsCached } from "../types/IsCached";
import type { LineDataFilters } from "../types/LineData";

export class SNCF {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(apiUrl: string, apiKey: string) {
    this.baseUrl = `${apiUrl}/coverage/fr-idf/`;
    this.headers = {
      Authorization: `Basic ${apiKey}`,
    };
  }

  async getStations() {
    try {
      const res = await fetch(this.baseUrl + "stop_areas", {
        headers: this.headers,
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      return data.stop_areas;
    } catch (e) {
      console.log(e);
      return [];
    }
  }

  async getDepartures(
    stationId: string,
    dateFrom: Date,
    filters?: LineDataFilters,
  ): Promise<IsCached<Departure[]>> {
    const redis = new Redis(process.env.REDIS_URL as string);

    let additionalParams = "";

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        additionalParams += `/${key}/${value}`;
      });
    }

    const url = `stop_areas/${stationId}${additionalParams}/departures?from_datetime=${dateFrom.toISOString()}`;
    const redisKey = `${stationId}${additionalParams}/departures/${format(dateFrom, "yyyyMMdd.HH.mm")}`;

    const cached = await redis.get(redisKey);

    if (cached) {
      console.log("using cached result");
      return {
        isCached: true,
        data: JSON.parse(cached),
      };
    } else {
      let resData: Departure[] = [];
      console.log("fething from SNCF API");

      try {
        const res = await fetch(this.baseUrl + url, { headers: this.headers });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        resData = data.departures;
      } catch (e) {
        console.log(e);
      }
      redis.set(redisKey, JSON.stringify(resData), "EX", 120);
      return {
        isCached: false,
        data: resData,
      };
    }
  }
}
